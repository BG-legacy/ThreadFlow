# ThreadFlow
> A high-performance C backend with Next.js frontend, exploring the power of system programming
![Screenshot 2025-02-23 at 3 58 31 PM](https://github.com/user-attachments/assets/5e200951-afee-496e-8c24-0b653553d06c)


## 🎯 What is ThreadFlow?
ThreadFlow is a modern full-stack application that demonstrates the power of C programming for backend services, combined with a sleek Next.js frontend. It showcases efficient thread management, real-time communication, and high-performance task processing.

## 🌟 Why C?
I created ThreadFlow to dive deep into system programming and understand:
- How modern web servers handle concurrent connections
- Memory management and optimization techniques
- Thread pools and task queue implementations
- Low-level networking and system calls
- Performance optimization at the system level

## 🏗 Architecture

### Backend (C)
The core server is built with:
- `libmicrohttpd` for HTTP server capabilities
- `libwebsockets` for WebSocket support
- Custom thread pool implementation
- Priority-based task queue system
- Signal handling for graceful shutdown

Key features:
- Non-blocking I/O operations
- Efficient thread management
- Real-time WebSocket communication
- Memory-efficient design patterns

### Frontend (Next.js)
Modern web interface featuring:
- Real-time updates via WebSocket
- Server-side rendering for optimal performance
- Clean, responsive UI
- TurboPack for rapid development

## 🚀 Getting Started

### Prerequisites
- GCC compiler
- Make build system
- Docker (optional)
- Node.js and npm

### Building the Backend
bash
cd backend
make
### Starting the Frontend
bash
cd frontend
npm install
npm run dev
### Using Docker
bash
docker-compose up --build

## 📚 Learning Highlights
Through building ThreadFlow, I've gained hands-on experience with:
- Thread synchronization primitives
- Memory management and leak prevention
- Network programming in C
- System-level optimizations
- Integration of C services with modern web technologies

## 🔧 Technical Deep Dive
### Thread Pool Design
- Custom implementation of worker threads
- Task queue with priority scheduling
- Mutex and condition variables for synchronization
- Graceful shutdown handling

### Network Layer
- HTTP server on port 8081
- WebSocket server on port 8082
- Custom protocol for real-time communication
- Efficient binary message handling

### Memory Management
- Custom memory pool for frequent allocations
- Careful tracking of allocated resources
- Proper cleanup on shutdown
- Valgrind-verified memory safety

## 🤝 Contributing
Contributions are welcome! This project is meant to be a learning resource for anyone interested in:
- System programming in C
- High-performance server design
- Full-stack application architecture
- Real-time web applications

## 📝 License
MIT License - Feel free to use this code for learning and building your own projects.

## 🙏 Acknowledgments
- The C Programming Language (K&R) book
- libmicrohttpd and libwebsockets communities
- Next.js documentation and community
- Various open-source C projects that inspired this work
