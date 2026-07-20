from fastapi import FastAPI, Header, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import os
import datetime
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import pandas as pd
import numpy as np

app = FastAPI(title="Internal ML Service API")

# Configuration
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_ML_SECRET", "dev_secret_key")

# Dependency for Internal Authentication
def verify_internal_key(x_internal_service_key: str = Header(...)):
    if x_internal_service_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service key"
        )
    return x_internal_service_key

# Schemas
class DailySalesPoint(BaseModel):
    date: datetime.date
    quantity_sold: int = Field(ge=0)

class PredictStockRequest(BaseModel):
    product_id: str
    current_stock: int = Field(ge=0)
    sales_history: List[DailySalesPoint]

class PredictStockResponse(BaseModel):
    product_id: str
    method: str = "linear_regression"
    predicted_out_of_stock_date: Optional[datetime.date] = None
    remaining_days: Optional[float] = None
    features_used: Dict[str, float]

class PredictDemandRequest(BaseModel):
    product_id: str
    sales_history: List[DailySalesPoint]

class PredictDemandResponse(BaseModel):
    product_id: str
    method: str
    estimated_daily_demand: float
    estimated_weekly_demand: float
    features_used: Dict[str, float | Dict[str, float]]

class DailyRevenuePoint(BaseModel):
    date: datetime.date
    revenue_amount: float = Field(ge=0)

class PredictRevenueRequest(BaseModel):
    revenue_history: List[DailyRevenuePoint]

class ForecastPoint(BaseModel):
    date: datetime.date
    predicted_revenue: float
    lower_bound: float
    upper_bound: float

class PredictRevenueResponse(BaseModel):
    method: str
    estimated_daily_revenue: float
    estimated_weekly_revenue: float
    features_used: Dict[str, float | Dict[str, float]]
    historical_data: List[DailyRevenuePoint] = []
    forecast_data: List[ForecastPoint] = []

# Endpoints
@app.post("/predict-stock", response_model=PredictStockResponse, dependencies=[Depends(verify_internal_key)])
async def predict_stock(request: PredictStockRequest):
    if len(request.sales_history) < 7:
        raise HTTPException(status_code=422, detail="Insufficient data, requires at least 7 days of history.")
    
    # Convert to DataFrame
    df = pd.DataFrame([s.model_dump() for s in request.sales_history])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # Feature Engineering
    sales_7d_avg = df.tail(7)['quantity_sold'].mean()
    sales_14d_avg = df.tail(14)['quantity_sold'].mean()
    
    # Linear Regression for trend
    df['day_index'] = (df['date'] - df['date'].min()).dt.days
    X = df[['day_index']].values
    y = df['quantity_sold'].values
    
    model = LinearRegression()
    model.fit(X, y)
    trend = model.coef_[0]
    
    # Calculate depletion
    # If trend is positive, demand is increasing.
    # We will use the recent 7d average as base daily demand, adjusted by trend.
    # For simplicity, if base demand <= 0, it means it's not selling.
    base_demand = sales_7d_avg
    if base_demand <= 0:
         remaining_days = None
         out_date = None
    else:
         remaining_days = request.current_stock / base_demand
         out_date = datetime.date.today() + datetime.timedelta(days=int(remaining_days))
         
    return PredictStockResponse(
        product_id=request.product_id,
        method="linear_regression",
        predicted_out_of_stock_date=out_date,
        remaining_days=remaining_days,
        features_used={
            "sales_7d_avg": float(sales_7d_avg),
            "sales_14d_avg": float(sales_14d_avg),
            "sales_trend": float(trend)
        }
    )

@app.post("/predict-demand", response_model=PredictDemandResponse, dependencies=[Depends(verify_internal_key)])
async def predict_demand(request: PredictDemandRequest):
    if len(request.sales_history) < 7:
        raise HTTPException(status_code=422, detail="Insufficient data, requires at least 7 days of history.")
        
    df = pd.DataFrame([s.model_dump() for s in request.sales_history])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # Feature Engineering
    sales_7d_avg = df.tail(7)['quantity_sold'].mean()
    sales_14d_avg = df.tail(14)['quantity_sold'].mean()
    
    df['day_index'] = (df['date'] - df['date'].min()).dt.days
    
    X = df[['day_index']].values
    y = df['quantity_sold'].values
    
    trend_model = LinearRegression()
    trend_model.fit(X, y)
    trend = trend_model.coef_[0]
    
    # One-hot encoding day of week
    df['day_of_week'] = df['date'].dt.day_name()
    day_effects = df.groupby('day_of_week')['quantity_sold'].mean().to_dict()
    
    # BR-15: Model selection
    method = "linear_regression"
    estimated_daily_demand = sales_7d_avg # fallback naive
    
    if len(df) >= 30:
        method = "random_forest"
        # Features for RF: day_index, day_of_week_encoded (simplification here)
        df_rf = pd.get_dummies(df, columns=['day_of_week'])
        feature_cols = [col for col in df_rf.columns if col not in ['date', 'quantity_sold']]
        X_rf = df_rf[feature_cols].values
        y_rf = df_rf['quantity_sold'].values
        
        rf = RandomForestRegressor(n_estimators=50, random_state=42)
        rf.fit(X_rf, y_rf)
        
        # Predict next 7 days
        future_dates = [df['date'].max() + datetime.timedelta(days=i) for i in range(1, 8)]
        future_df = pd.DataFrame({'date': future_dates})
        future_df['day_index'] = (future_df['date'] - df['date'].min()).dt.days
        future_df['day_of_week'] = future_df['date'].dt.day_name()
        future_df = pd.get_dummies(future_df, columns=['day_of_week'])
        
        # Align columns
        for col in feature_cols:
            if col not in future_df.columns:
                future_df[col] = 0
        
        future_preds = rf.predict(future_df[feature_cols].values)
        estimated_daily_demand = future_preds.mean()
    else:
        # Linear Regression based prediction for next 7 days
        next_day_index = df['day_index'].max() + 4 # mid of next week
        estimated_daily_demand = trend_model.predict([[next_day_index]])[0]
        if estimated_daily_demand < 0:
            estimated_daily_demand = 0

    return PredictDemandResponse(
        product_id=request.product_id,
        method=method,
        estimated_daily_demand=float(estimated_daily_demand),
        estimated_weekly_demand=float(estimated_daily_demand * 7),
        features_used={
            "sales_7d_avg": float(sales_7d_avg),
            "sales_14d_avg": float(sales_14d_avg),
            "sales_trend": float(trend),
            "day_of_week_effect": {k: float(v) for k, v in day_effects.items()}
        }
    )

@app.post("/predict-revenue", response_model=PredictRevenueResponse, dependencies=[Depends(verify_internal_key)])
async def predict_revenue(request: PredictRevenueRequest):
    if len(request.revenue_history) < 7:
        raise HTTPException(status_code=422, detail="Insufficient data, requires at least 7 days of history.")
        
    df = pd.DataFrame([s.model_dump() for s in request.revenue_history])
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    
    # Feature Engineering
    revenue_7d_avg = df.tail(7)['revenue_amount'].mean()
    
    df['day_index'] = (df['date'] - df['date'].min()).dt.days
    
    X = df[['day_index']].values
    y = df['revenue_amount'].values
    
    trend_model = LinearRegression()
    trend_model.fit(X, y)
    trend = trend_model.coef_[0]
    
    # Calculate historical data list
    historical_data = []
    for _, row in df.iterrows():
        historical_data.append(DailyRevenuePoint(date=row['date'].date(), revenue_amount=row['revenue_amount']))
        
    method = "linear_regression"
    forecast_data = []
    
    if len(df) >= 14:
        method = "random_forest"
        df['day_of_week'] = df['date'].dt.day_name()
        df_rf = pd.get_dummies(df, columns=['day_of_week'])
        feature_cols = [col for col in df_rf.columns if col not in ['date', 'revenue_amount']]
        X_rf = df_rf[feature_cols].values
        y_rf = df_rf['revenue_amount'].values
        
        rf = RandomForestRegressor(n_estimators=50, random_state=42)
        rf.fit(X_rf, y_rf)
        
        import numpy as np
        # Calculate standard deviation of residuals for confidence bounds
        preds = rf.predict(X_rf)
        std_dev = np.std(y_rf - preds)
        
        # Predict next 7 days
        future_dates = [df['date'].max() + datetime.timedelta(days=i) for i in range(1, 8)]
        future_df = pd.DataFrame({'date': future_dates})
        future_df['day_index'] = (future_df['date'] - df['date'].min()).dt.days
        future_df['day_of_week'] = future_df['date'].dt.day_name()
        future_df = pd.get_dummies(future_df, columns=['day_of_week'])
        
        for col in feature_cols:
            if col not in future_df.columns:
                future_df[col] = 0
                
        future_preds = rf.predict(future_df[feature_cols].values)
        estimated_daily_revenue = future_preds.mean()
        
        for idx, date in enumerate(future_dates):
            pred_val = float(future_preds[idx])
            # 95% CI roughly 1.96 * std_dev
            lower = max(0, pred_val - 1.96 * std_dev)
            upper = pred_val + 1.96 * std_dev
            forecast_data.append(ForecastPoint(date=date.date(), predicted_revenue=pred_val, lower_bound=lower, upper_bound=upper))

    else:
        # Linear Regression based prediction for next 7 days
        import numpy as np
        std_dev = np.std(y - trend_model.predict(X))
        
        future_dates = [df['date'].max() + datetime.timedelta(days=i) for i in range(1, 8)]
        future_preds = []
        for i, date in enumerate(future_dates):
            next_day_index = df['day_index'].max() + i + 1
            pred_val = trend_model.predict([[next_day_index]])[0]
            if pred_val < 0:
                pred_val = 0
            future_preds.append(pred_val)
            
            lower = max(0, pred_val - 1.96 * std_dev)
            upper = pred_val + 1.96 * std_dev
            forecast_data.append(ForecastPoint(date=date.date(), predicted_revenue=pred_val, lower_bound=lower, upper_bound=upper))
            
        estimated_daily_revenue = sum(future_preds) / len(future_preds)

    return PredictRevenueResponse(
        method=method,
        estimated_daily_revenue=float(estimated_daily_revenue),
        estimated_weekly_revenue=float(estimated_daily_revenue * 7),
        features_used={
            "revenue_7d_avg": float(revenue_7d_avg),
            "revenue_trend": float(trend)
        },
        historical_data=historical_data,
        forecast_data=forecast_data
    )
