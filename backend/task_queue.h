#ifndef TASK_QUEUE_H
#define TASK_QUEUE_H

// Task structure
typedef struct Task {
    int priority;
    void* data;
    struct Task* next;
} Task;

// Queue structure
typedef struct TaskQueue {
    Task* head;
    Task* tail;
    pthread_mutex_t lock;
    int size;
} TaskQueue;

// Core functions
TaskQueue* queue_init(void);
int queue_push(TaskQueue* queue, void* data, int priority);
void* queue_pop(TaskQueue* queue);
int queue_size(TaskQueue* queue);
void queue_destroy(TaskQueue* queue);

#endif // TASK_QUEUE_H 