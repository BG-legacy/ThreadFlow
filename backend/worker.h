#ifndef WORKER_H
#define WORKER_H

#include <stdbool.h>
#include "task_queue.h"

// Worker structure
typedef struct {
    pthread_t thread;          // Thread handle
    TaskQueue* queue;         // Reference to task queue
    bool running;             // Worker running flag
    int worker_id;           // Unique worker identifier
} Worker;

// Function declarations
Worker* worker_create(TaskQueue* queue, int worker_id);
void worker_destroy(Worker* worker);
Worker** create_worker_pool(TaskQueue* queue, int num_workers);
void destroy_worker_pool(Worker** workers, int num_workers);

#endif // WORKER_H 