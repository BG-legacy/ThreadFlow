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

# Copy source files explicitly
COPY server.c server.c
COPY task_queue.c task_queue.c
COPY worker.c worker.c
COPY websocket.c websocket.c
COPY task_queue.h task_queue.h
COPY worker.h worker.h
COPY websocket.h websocket.h

# Compile the application
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