# Multi-stage build for optimized AI service image
FROM python:3.11-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch with CUDA support (if available)
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies
COPY apps/ai/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and other libraries
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgcc-s1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY apps/ai/ ./

# Create directories for models and logs
RUN mkdir -p /app/models /app/logs /app/storage

# Set environment variables
ENV PORT=8000
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose ports
EXPOSE 8000
# gRPC port
EXPOSE 50051

# Create health check script
RUN echo '#!/bin/bash\ncurl -f http://localhost:${PORT:-8000}/health || exit 1' > /app/health_check.sh && chmod +x /app/health_check.sh

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD ["/app/health_check.sh"]

# Default command runs FastAPI server, but can be overridden
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${CONCURRENCY:-4}"]
