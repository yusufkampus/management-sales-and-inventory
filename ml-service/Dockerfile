FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies first (for Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 7860 (required by Hugging Face Spaces)
EXPOSE 7860

# Start the FastAPI application with uvicorn
# Support both HF Spaces (default 7860) and Railway (dynamic PORT)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}
