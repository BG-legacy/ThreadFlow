#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "task_queue.h"
#include "websocket.h"
#include <json-c/json.h>
#include <libwebsockets.h>

// Worker state
typedef struct {
    pthread_t thread;          // Thread handle
    TaskQueue* queue;         // Reference to task queue
    bool running;             // Worker running flag
    int worker_id;           // Unique worker identifier
} Worker;

// Function to process a task
void process_task(TaskQueue* queue) {
    // Get task from queue
    struct json_object* task = queue_pop(queue);
    if (!task) {
        printf("[WORKER] No task to process\n");
        return;
    }

    // Extract task ID and data
    struct json_object* id_obj;
    struct json_object* data_obj;
    const char* task_id = NULL;
    
    if (json_object_object_get_ex(task, "id", &id_obj)) {
        task_id = json_object_get_string(id_obj);
        printf("[WORKER] Starting task ID: %s\n", task_id);
    } else {
        // Generate a new ID if none exists
        task_id = json_object_to_json_string(task);
        printf("[WORKER] Generated task ID: %s\n", task_id);
    }

    // Simulate processing with sleep
    printf("[WORKER] Task %s: Processing for 2 seconds...\n", task_id);
    sleep(2);
    printf("[WORKER] Task %s: Processing complete\n", task_id);

    // Create completion notification
    struct json_object* notification = json_object_new_object();
    json_object_object_add(notification, "type", json_object_new_string("task_complete"));
    json_object_object_add(notification, "task_id", json_object_new_string(task_id));
    json_object_object_add(notification, "status", json_object_new_string("completed"));
    json_object_object_add(notification, "timestamp", json_object_new_int64(time(NULL)));

    // Convert to string and broadcast
    const char* notification_str = json_object_to_json_string_ext(notification, JSON_C_TO_STRING_PRETTY);
    printf("[WORKER] Broadcasting notification:\n%s\n", notification_str);
    
    // Add explicit length calculation
    size_t msg_len = strlen(notification_str);
    printf("[WORKER] Message length: %zu bytes\n", msg_len);
    
    // Broadcast with length
    broadcast_to_clients(notification_str, msg_len);
    printf("[WORKER] Task %s: Broadcast complete\n", task_id);

    // Cleanup
    json_object_put(notification);
    json_object_put(task);
}

// Main worker thread function
static void* worker_thread(void* arg) {
    Worker* worker = (Worker*)arg;
    
    printf("Worker %d started\n", worker->worker_id);
    
    while (worker->running) {
        // Process the task
        process_task(worker->queue);
        
        // Small sleep to prevent busy-waiting
        usleep(100000); // 100ms sleep
    }
    
    printf("Worker %d stopped\n", worker->worker_id);
    return NULL;
}

// Create and start a new worker
Worker* worker_create(TaskQueue* queue, int worker_id) {
    Worker* worker = (Worker*)malloc(sizeof(Worker));
    if (!worker) return NULL;
    
    worker->queue = queue;
    worker->running = true;
    worker->worker_id = worker_id;
    
    // Create the worker thread
    if (pthread_create(&worker->thread, NULL, worker_thread, worker) != 0) {
        free(worker);
        return NULL;
    }
    
    return worker;
}

// Stop and cleanup a worker
void worker_destroy(Worker* worker) {
    if (!worker) return;
    
    // Signal the worker to stop
    worker->running = false;
    
    // Wait for the worker thread to finish
    pthread_join(worker->thread, NULL);
    
    // Clean up
    free(worker);
}

// Create a pool of workers
Worker** create_worker_pool(TaskQueue* queue, int num_workers) {
    Worker** workers = (Worker**)malloc(sizeof(Worker*) * num_workers);
    if (!workers) return NULL;
    
    for (int i = 0; i < num_workers; i++) {
        workers[i] = worker_create(queue, i);
        if (!workers[i]) {
            // Cleanup on failure
            for (int j = 0; j < i; j++) {
                worker_destroy(workers[j]);
            }
            free(workers);
            return NULL;
        }
    }
    
    return workers;
}

// Destroy a pool of workers
void destroy_worker_pool(Worker** workers, int num_workers) {
    if (!workers) return;
    
    for (int i = 0; i < num_workers; i++) {
        worker_destroy(workers[i]);
    }
    
    free(workers);
} 