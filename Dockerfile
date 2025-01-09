# Base Image
FROM python:3.9-slim

# Set Environment Variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set Working Directory
WORKDIR /app

# Install Dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy App Code
COPY . /app/

# Expose Port
EXPOSE 5000

# Command to Run Application
CMD ["python", "app-neu.py"]
