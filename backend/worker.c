#include <pthread.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include "task_queue.h"
#include "websocket.h"
#include <json-c/json.h>
#include <libwebsockets.h>
#include "worker.h"
#include <time.h>

// Forward declaration for the add_completed_task function from server.c
extern void add_completed_task(const char* task_id);

// Function to process a task
static void process_task(struct json_object* task) {
    // Extract task ID
    struct json_object* id_obj;
    if (!json_object_object_get_ex(task, "id", &id_obj)) {
        fprintf(stderr, "Task has no ID\n");
        return;
    }
    const char* task_id = json_object_get_string(id_obj);
    
    // Extract task data
    struct json_object* data_obj;
    if (!json_object_object_get_ex(task, "data", &data_obj)) {
        fprintf(stderr, "Task has no data\n");
        return;
    }
    
    // Simulate processing by sleeping
    int sleep_time = rand() % 3 + 1;  // 1-3 seconds
    printf("[WORKER] Processing task %s for %d seconds...\n", task_id, sleep_time);
    sleep(sleep_time);
    
    // Update task status to completed
    json_object_object_add(task, "status", json_object_new_string("completed"));
    
    printf("[WORKER] Task %s completed\n", task_id);
    
    // Notify clients of task completion using the new function
    add_completed_task(task_id);
}

// Main worker thread function
static void* worker_thread(void* arg) {
    Worker* worker = (Worker*)arg;
    
    printf("Worker %d started\n", worker->worker_id);
    
    while (worker->running) {
        // Process the task
        struct json_object* task = queue_pop(worker->queue);
        if (task) {
            process_task(task);
            json_object_put(task);
        } else {
            // Small sleep to prevent busy-waiting
            usleep(100000); // 100ms sleep
        }
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