FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8012

# Create logs directory
RUN mkdir -p logs && chmod 777 logs

# Run with a single worker in development mode
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8012", "--workers", "1"]
