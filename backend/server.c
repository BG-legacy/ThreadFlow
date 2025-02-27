#include <sys/types.h>
#include <microhttpd.h>
#include <json-c/json.h>
#include <string.h>
#include <stdio.h>    // Add this for printf, fprintf, snprintf
#include <signal.h>
#include <unistd.h>  // Add this for usleep
#include <time.h>    // Add this for time()
#include "task_queue.h"
#include "worker.h"

#define MAX_CLIENTS 100
#define NUM_WORKERS 2  // Number of worker threads to create

// Global variables
static TaskQueue* task_queue;
static volatile int shutdown_requested = 0;
static Worker** workers = NULL;
static int http_port;  // Added global variable

// Function declarations
static void handle_sigint(int sig);

// Signal handler implementation
static void handle_sigint(int sig) {
    shutdown_requested = 1;
}

// Store completed tasks for polling
#define MAX_COMPLETED_TASKS 100
static struct {
    char task_id[32];
    time_t completion_time;
} completed_tasks[MAX_COMPLETED_TASKS];
static int completed_task_count = 0;
static int completed_task_index = 0;

// Function to add a completed task to the list
void add_completed_task(const char* task_id) {
    time_t now = time(NULL);
    
    // Add to circular buffer
    strncpy(completed_tasks[completed_task_index].task_id, task_id, 31);
    completed_tasks[completed_task_index].task_id[31] = '\0';
    completed_tasks[completed_task_index].completion_time = now;
    
    completed_task_index = (completed_task_index + 1) % MAX_COMPLETED_TASKS;
    if (completed_task_count < MAX_COMPLETED_TASKS) {
        completed_task_count++;
    }
    
    printf("[SERVER] Task completed: %s\n", task_id);
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

    // Health check endpoint
    if (strcmp(method, "GET") == 0 && strcmp(url, "/health") == 0) {
        const char *health = "{\"status\":\"ok\",\"http_port\":%d,\"version\":\"1.0.0\",\"cors\":\"enabled\",\"environment\":\"%s\",\"uptime\":%ld}";
        char buf[512]; // Increased buffer size
        
        // Get uptime in seconds
        static time_t start_time = 0;
        if (start_time == 0) {
            start_time = time(NULL);
        }
        time_t uptime = time(NULL) - start_time;
        
        // Determine environment
        const char* env = getenv("RENDER_SERVICE_ID") ? "production" : "development";
        
        snprintf(buf, sizeof(buf), health, http_port, env, uptime);
        
        response = MHD_create_response_from_buffer(strlen(buf), 
                                                 buf,
                                                 MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(response, "Content-Type", "application/json");
        MHD_add_response_header(response, "Access-Control-Allow-Origin", "*");
        ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
        MHD_destroy_response(response);
        return ret;
    }

    // New endpoint for polling completed tasks
    if (strcmp(method, "GET") == 0 && strcmp(url, "/completed-tasks") == 0) {
        // Create JSON array of completed tasks
        struct json_object *tasks_array = json_object_new_array();
        
        // Get the 'since' parameter if provided
        const char *since_str = MHD_lookup_connection_value(connection, MHD_GET_ARGUMENT_KIND, "since");
        time_t since_time = 0;
        if (since_str) {
            since_time = (time_t)atol(since_str);
        }
        
        // Add completed tasks to the array
        for (int i = 0; i < completed_task_count; i++) {
            int idx = (completed_task_index - 1 - i + MAX_COMPLETED_TASKS) % MAX_COMPLETED_TASKS;
            
            // Skip tasks completed before the 'since' time
            if (since_time > 0 && completed_tasks[idx].completion_time <= since_time) {
                continue;
            }
            
            struct json_object *task = json_object_new_object();
            json_object_object_add(task, "task_id", json_object_new_string(completed_tasks[idx].task_id));
            json_object_object_add(task, "completion_time", json_object_new_int64(completed_tasks[idx].completion_time));
            json_object_array_add(tasks_array, task);
        }
        
        // Create response object
        struct json_object *response_obj = json_object_new_object();
        json_object_object_add(response_obj, "completed_tasks", tasks_array);
        json_object_object_add(response_obj, "server_time", json_object_new_int64(time(NULL)));
        
        const char *response_str = json_object_to_json_string(response_obj);
        response = MHD_create_response_from_buffer(strlen(response_str), 
                                                 (void*)response_str,
                                                 MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(response, "Content-Type", "application/json");
        MHD_add_response_header(response, "Access-Control-Allow-Origin", "https://thread-flow.vercel.app");
        ret = MHD_queue_response(connection, MHD_HTTP_OK, response);
        MHD_destroy_response(response);
        json_object_put(response_obj);
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
    http_port = get_port("PORT", 8081);
    
    // For Render deployment, we need to check if we're in production
    // and use the same port for both HTTP and WebSocket
    const char* render_service_id = getenv("RENDER_SERVICE_ID");
    bool is_production = render_service_id != NULL;
    
    if (is_production) {
        printf("Running in production mode on Render\n");
        // No need to set WebSocket port anymore
        printf("Using HTTP port %d\n", http_port);
        
        // Print environment variables for debugging
        printf("Environment variables:\n");
        printf("  RENDER_SERVICE_ID: %s\n", render_service_id ? render_service_id : "not set");
        printf("  PORT: %d\n", http_port);
        
        // Check if we're behind a proxy
        const char* forwarded_proto = getenv("X_FORWARDED_PROTO");
        if (forwarded_proto) {
            printf("  X_FORWARDED_PROTO: %s\n", forwarded_proto);
        }
    }

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
        queue_destroy(task_queue);
        return 1;
    }

    printf("Server started successfully:\n");
    printf("HTTP server running on port %d\n", http_port);

    // Register signal handler for graceful shutdown
    signal(SIGINT, handle_sigint);
    
    printf("Press Ctrl+C to stop the server\n");
    
    // Main event loop
    while (!shutdown_requested) {
        // Just sleep, no WebSocket service needed
        usleep(10000);  // 10ms sleep to reduce CPU usage
    }
    
    printf("Shutting down server...\n");
    
    // Cleanup
    if (daemon) MHD_stop_daemon(daemon);
    
    destroy_worker_pool(workers, NUM_WORKERS);
    queue_destroy(task_queue);
    
    printf("Server shutdown complete\n");
    return 0;
} 