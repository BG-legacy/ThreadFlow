# Use a base image with C build tools
FROM gcc:latest

# Install dependencies
RUN apt-get update && apt-get install -y \
    libmicrohttpd-dev \
    libwebsockets-dev \
    libjson-c-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create backend directory
RUN mkdir -p /app/backend

# Copy backend source files to the backend directory
COPY backend/*.c backend/*.h /app/backend/

# Compile the application
WORKDIR /app/backend
RUN gcc -c server.c task_queue.c worker.c websocket.c && \
    gcc -o server server.o task_queue.o worker.o websocket.o \
    -lmicrohttpd -lwebsockets -ljson-c -pthread

# Default ports - use PORT env var for primary port (Render requirement)
ENV PORT=8081
ENV WS_PORT=8082

# Expose ports
EXPOSE ${PORT}
EXPOSE ${WS_PORT}

# Start command
CMD ["./server"] 