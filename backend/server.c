#include <sys/types.h>
#include <microhttpd.h>
#include <libwebsockets.h>
#include <json-c/json.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>  // Add this for usleep
#include <time.h>    // Add this for time()
#include "task_queue.h"
#include "worker.h"
#include "websocket.h"  // Fixed include statement

#define MAX_CLIENTS 100
#define NUM_WORKERS 2  // Number of worker threads to create

// Global variables
static TaskQueue* task_queue;
static volatile int shutdown_requested = 0;
static Worker** workers = NULL;

// Function declarations
static void handle_sigint(int sig);

// Signal handler implementation
static void handle_sigint(int sig) {
    shutdown_requested = 1;
}

// WebSocket protocol definition
static struct lws_protocols protocols[] = {
    {
        "task-protocol",
        ws_callback,
        0,
        0,
    },
    { NULL, NULL, 0, 0 }
};

// Broadcast task completion to all WebSocket clients
static void broadcast_task_completion(const char* task_id) {
    char buf[256];
    snprintf(buf, sizeof(buf), 
             "{\"type\":\"task_complete\",\"task_id\":\"%s\",\"status\":\"completed\"}", 
             task_id);
    
    broadcast_to_clients(buf, strlen(buf));
}

// HTTP request handler
static enum MHD_Result handle_request(void *cls, struct MHD_Connection *connection,
                                    const char *url, const char *method,
                                    const char *version, const char *upload_data,
                                    size_t *upload_data_size, void **con_cls) {
    static int dummy;
    struct MHD_Response *response;
    enum MHD_Result ret;
    static char *request_data = NULL;
    static size_t request_data_size = 0;

    // First call handling
    if (*con_cls == NULL) {
        *con_cls = &dummy;
        return MHD_YES;
    }

    // Handle CORS preflight requests
    if (strcmp(method, "OPTIONS") == 0) {
        response = MHD_create_response_from_buffer(0, NULL, MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
        MHD_add_response_header(response, "Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        MHD_add_response_header(response, "Access-Control-Allow-Headers", "Content-Type");
        MHD_add_response_header(response, "Access-Control-Max-Age", "86400");
        ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
        MHD_destroy_response(response);
        return ret;
    }

    // Handle POST request for task submission
    if (strcmp(method, "POST") == 0 && strcmp(url, "/submit") == 0) {
        if (*upload_data_size != 0) {
            // Accumulate request data
            char *new_data = realloc(request_data, request_data_size + *upload_data_size + 1);
            if (!new_data) {
                free(request_data);
                return MHD_NO;
            }
            request_data = new_data;
            memcpy(request_data + request_data_size, upload_data, *upload_data_size);
            request_data_size += *upload_data_size;
            request_data[request_data_size] = '\0';
            *upload_data_size = 0;
            return MHD_YES;
        }

        // Process the complete request
        if (request_data) {
            struct json_object *request = json_tokener_parse(request_data);
            if (request) {
                struct json_object *data_obj, *priority_obj;
                if (json_object_object_get_ex(request, "data", &data_obj) &&
                    json_object_object_get_ex(request, "priority", &priority_obj)) {
                    
                    // Generate a unique task ID using timestamp and random number
                    char task_id[32];
                    snprintf(task_id, sizeof(task_id), "task_%ld_%d", 
                            time(NULL), rand() % 1000);
                    
                    // Create task object with proper ID
                    struct json_object *task = json_object_new_object();
                    json_object_object_add(task, "id", json_object_new_string(task_id));
                    json_object_object_add(task, "data", json_object_get(data_obj));
                    json_object_object_add(task, "priority", json_object_get(priority_obj));
                    json_object_object_add(task, "status", json_object_new_string("pending"));
                    
                    // Add to queue
                    int priority = json_object_get_int(priority_obj);
                    if (queue_push(task_queue, task, priority) == 0) {
                        printf("[SERVER] Task added to queue: %s\n", 
                               json_object_to_json_string(task));
                        
                        // Create success response with task ID
                        struct json_object* response_obj = json_object_new_object();
                        json_object_object_add(response_obj, "status", 
                                             json_object_new_string("success"));
                        json_object_object_add(response_obj, "task_id", 
                                             json_object_new_string(task_id));
                        
                        const char* response_str = json_object_to_json_string(response_obj);
                        response = MHD_create_response_from_buffer(strlen(response_str), 
                                                                 (void*)response_str,
                                                                 MHD_RESPMEM_MUST_COPY);
                        MHD_add_response_header(response, "Content-Type", "application/json");
                        MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
                        ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
                        MHD_destroy_response(response);
                        json_object_put(response_obj);
                    } else {
                        // Queue error response
                        const char *error = "{\"error\":\"Failed to add task to queue\"}";
                        response = MHD_create_response_from_buffer(strlen(error),
                                                                 (void*)error,
                                                                 MHD_RESPMEM_PERSISTENT);
                        MHD_add_response_header(response, "Content-Type", "application/json");
                        MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
                        ret = MHD_queue_response(connection, MHD_HTTP_INTERNAL_SERVER_ERROR, response);
                        MHD_destroy_response(response);
                    }
                }
                json_object_put(request);
            }
            
            // Cleanup
            free(request_data);
            request_data = NULL;
            request_data_size = 0;
            
            return ret;
        }
    }

    // Handle GET request
    if (strcmp(method, "GET") == 0 && strcmp(url, "/tasks") == 0) {
        char buf[32];
        snprintf(buf, sizeof(buf), "{\"tasks\":%d}", queue_size(task_queue));
        response = MHD_create_response_from_buffer(strlen(buf), 
                                                 buf,
                                                 MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(response, "Content-Type", "application/json");
        MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
        ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
        MHD_destroy_response(response);
        return ret;
    }

    // 404 Not Found for all other requests
    const char *not_found = "{\"error\":\"Not Found\"}";
    response = MHD_create_response_from_buffer(strlen(not_found), 
                                             (void*)not_found,
                                             MHD_RESPMEM_PERSISTENT);
    MHD_add_response_header(response, "Content-Type", "application/json");
    MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
    ret = MHD_queue_response(connection, MHD_HTTP_NOT_FOUND, response);
    MHD_destroy_response(response);
    return ret;
}

// Use environment variables for ports if available
static int get_port(const char* env_var, int default_port) {
    const char* port_str = getenv(env_var);
    if (port_str) {
        int port = atoi(port_str);
        return port > 0 ? port : default_port;
    }
    return default_port;
}

int main() {
    // Initialize task queue
    task_queue = queue_init();
    if (!task_queue) {
        fprintf(stderr, "Failed to initialize task queue\n");
        return 1;
    }

    // Create worker pool
    workers = create_worker_pool(task_queue, NUM_WORKERS);
    if (!workers) {
        fprintf(stderr, "Failed to create worker pool\n");
        queue_destroy(task_queue);
        return 1;
    }

    // Get port numbers from environment or use defaults
    // Use PORT env var for HTTP (Render requirement)
    int http_port = get_port("PORT", 8081);
    int ws_port = get_port("WS_PORT", 8082);
    
    // For Render deployment, we need to check if we're in production
    // and use the same port for both HTTP and WebSocket
    const char* render_service_id = getenv("RENDER_SERVICE_ID");
    bool is_production = render_service_id != NULL;
    
    if (is_production) {
        printf("Running in production mode on Render\n");
        // In production, use the same port for both HTTP and WebSocket
        ws_port = http_port;
    }

    // Initialize WebSocket server with more detailed error handling
    struct lws_context_creation_info info;
    memset(&info, 0, sizeof info);

    // Basic server options
    info.port = ws_port;
    info.protocols = protocols;
    info.gid = -1;
    info.uid = -1;

    // Critical WebSocket options
    info.iface = NULL;  // Listen on all interfaces
    
    // Update vhost name to match deployment or use NULL for any host
    info.vhost_name = NULL;  // Allow connections from any host
    
    // Add options for working behind a proxy (like Render)
    info.options = 
        LWS_SERVER_OPTION_HTTP_HEADERS_SECURITY_BEST_PRACTICES_ENFORCE |
        LWS_SERVER_OPTION_VALIDATE_UTF8 |
        LWS_SERVER_OPTION_EXPLICIT_VHOSTS |
        LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;

    // Create the context
    struct lws_context* ws_context = lws_create_context(&info);
    if (!ws_context) {
        fprintf(stderr, "WebSocket server creation failed\n");
        return 1;
    }
    set_ws_context(ws_context);

    printf("[WEBSOCKET] Server started on port %d\n", ws_port);

    // Start HTTP server with port binding retry logic
    struct MHD_Daemon *daemon = NULL;
    int retry_count = 0;
    const int max_retries = 3;

    while (!daemon && retry_count < max_retries) {
        daemon = MHD_start_daemon(
            MHD_USE_THREAD_PER_CONNECTION,
            http_port, NULL, NULL,
            &handle_request, NULL,
            MHD_OPTION_END);

        if (!daemon) {
            fprintf(stderr, "Failed to bind HTTP server to port %d (attempt %d/%d)\n", 
                    http_port, retry_count + 1, max_retries);
            http_port++; // Try next port
            retry_count++;
        }
    }

    if (!daemon) {
        fprintf(stderr, "Failed to start HTTP server after %d attempts\n", max_retries);
        fprintf(stderr, "Set HTTP_PORT environment variable to specify an alternative port.\n");
        lws_context_destroy(get_ws_context());
        queue_destroy(task_queue);
        return 1;
    }

    printf("Server started successfully:\n");
    printf("HTTP server running on port %d\n", http_port);
    printf("WebSocket server running on port %d\n", ws_port);

    // Register signal handler for graceful shutdown
    signal(SIGINT, handle_sigint);
    
    printf("Press Ctrl+C to stop the server\n");
    
    // Main event loop
    while (!shutdown_requested) {
        lws_service(get_ws_context(), 50);
        usleep(10000);  // 10ms sleep to reduce CPU usage
    }
    
    printf("Shutting down server...\n");
    
    // Cleanup
    if (daemon) MHD_stop_daemon(daemon);
    
    lws_context_destroy(get_ws_context());
    destroy_worker_pool(workers, NUM_WORKERS);
    queue_destroy(task_queue);
    
    printf("Server shutdown complete\n");
    return 0;
} 