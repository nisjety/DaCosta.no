FROM python:3.9-slim

WORKDIR /app

# Install Python dependencies
COPY models/requirements.txt ./models/requirements.txt
RUN pip install --no-cache-dir -r models/requirements.txt

# Copy Python model files
COPY models/ ./models/

EXPOSE 5014

# Set environment variables
ENV MODEL_API_PORT=5014
ENV PYTHONPATH=/app

# Command to run the application
CMD ["python", "models/model_api_server.py"]
