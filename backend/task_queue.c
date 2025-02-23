#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include "task_queue.h"

// Initialize a new task queue
TaskQueue* queue_init() {
    TaskQueue* queue = (TaskQueue*)malloc(sizeof(TaskQueue));
    if (!queue) return NULL;

    queue->head = NULL;
    queue->tail = NULL;
    queue->size = 0;
    pthread_mutex_init(&queue->lock, NULL);
    return queue;
}

// Add a task to the queue (with priority)
int queue_push(TaskQueue* queue, void* data, int priority) {
    if (!queue) return -1;

    Task* new_task = (Task*)malloc(sizeof(Task));
    if (!new_task) return -1;

    new_task->data = data;
    new_task->priority = priority;
    new_task->next = NULL;

    pthread_mutex_lock(&queue->lock);

    // Empty queue case
    if (!queue->head) {
        queue->head = queue->tail = new_task;
    } else {
        // Priority insertion
        if (priority < queue->head->priority) {
            // Insert at head
            new_task->next = queue->head;
            queue->head = new_task;
        } else {
            // Find insertion point
            Task* current = queue->head;
            Task* prev = NULL;
            
            while (current && current->priority <= priority) {
                prev = current;
                current = current->next;
            }

            if (!current) {
                // Insert at tail
                queue->tail->next = new_task;
                queue->tail = new_task;
            } else {
                // Insert in middle
                new_task->next = current;
                prev->next = new_task;
            }
        }
    }

    queue->size++;
    pthread_mutex_unlock(&queue->lock);
    return 0;
}

// Remove and return the highest priority task
void* queue_pop(TaskQueue* queue) {
    if (!queue || !queue->head) return NULL;

    pthread_mutex_lock(&queue->lock);
    
    Task* task = queue->head;
    void* data = task->data;
    
    queue->head = task->next;
    if (!queue->head) {
        queue->tail = NULL;
    }
    
    queue->size--;
    pthread_mutex_unlock(&queue->lock);
    
    free(task);
    return data;
}

// Get current queue size
int queue_size(TaskQueue* queue) {
    if (!queue) return 0;
    
    pthread_mutex_lock(&queue->lock);
    int size = queue->size;
    pthread_mutex_unlock(&queue->lock);
    
    return size;
}

// Clean up queue resources
void queue_destroy(TaskQueue* queue) {
    if (!queue) return;

    pthread_mutex_lock(&queue->lock);
    
    Task* current = queue->head;
    while (current) {
        Task* next = current->next;
        free(current);
        current = next;
    }
    
    pthread_mutex_unlock(&queue->lock);
    pthread_mutex_destroy(&queue->lock);
    free(queue);
} 