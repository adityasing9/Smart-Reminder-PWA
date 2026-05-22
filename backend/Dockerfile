FROM python:3.11-slim

WORKDIR /workspace

# Install system dependencies (libpq-dev needed for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose port 8000
EXPOSE 8000

# Command to run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
