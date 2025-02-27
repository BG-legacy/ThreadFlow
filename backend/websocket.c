#include "websocket.h"
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

// Define the global variables as static
static struct lws* ws_clients[MAX_CLIENTS] = {0};  // Initialize to NULL
static int client_count = 0;
static struct lws_context* ws_context = NULL;

// Getter for ws_context
struct lws_context* get_ws_context(void) {
    return ws_context;
}

// Setter for ws_context
void set_ws_context(struct lws_context* context) {
    ws_context = context;
}

// Define the callback function
int ws_callback(struct lws *wsi, enum lws_callback_reasons reason,
                void *user, void *in, size_t len) {
    switch (reason) {
        case LWS_CALLBACK_ESTABLISHED:
            printf("[WEBSOCKET] Client connected\n");
            
            // Log connection details
            char client_ip[100] = {0};
            char client_name[100] = {0};
            
            lws_get_peer_addresses(wsi, lws_get_socket_fd(wsi),
                                  client_name, sizeof(client_name),
                                  client_ip, sizeof(client_ip));
                                  
            printf("[WEBSOCKET] Client connected from IP: %s, Host: %s\n", 
                   client_ip, client_name);
            
            // Check if we're behind a proxy
            const char* forwarded_for = lws_get_header_simple(wsi, "X-Forwarded-For");
            if (forwarded_for) {
                printf("[WEBSOCKET] X-Forwarded-For: %s\n", forwarded_for);
            }
            
            // Check the origin
            const char* origin = lws_get_header_simple(wsi, "Origin");
            if (origin) {
                printf("[WEBSOCKET] Origin: %s\n", origin);
                
                // Accept connections from Vercel frontend
                if (strstr(origin, "thread-flow.vercel.app") != NULL) {
                    printf("[WEBSOCKET] Accepted connection from Vercel frontend\n");
                }
            }
            
            if (client_count < MAX_CLIENTS) {
                ws_clients[client_count++] = wsi;
                printf("[WEBSOCKET] Total clients: %d\n", client_count);
            }
            break;

        case LWS_CALLBACK_CLOSED:
            printf("[WEBSOCKET] Client disconnected\n");
            for (int i = 0; i < client_count; i++) {
                if (ws_clients[i] == wsi) {
                    // Remove client by shifting array
                    for (int j = i; j < client_count - 1; j++) {
                        ws_clients[j] = ws_clients[j + 1];
                    }
                    client_count--;
                    printf("[WEBSOCKET] Remaining clients: %d\n", client_count);
                    break;
                }
            }
            break;

        case LWS_CALLBACK_RECEIVE:
            printf("[WEBSOCKET] Received: %.*s\n", (int)len, (char *)in);
            
            // Echo back the message for testing
            lws_callback_on_writable(wsi);
            break;

        case LWS_CALLBACK_SERVER_WRITEABLE:
            // Send a ping response when writable
            {
                unsigned char buf[LWS_PRE + 64];
                const char *msg = "{\"type\":\"pong\",\"timestamp\":%ld}";
                int msg_len = snprintf((char *)&buf[LWS_PRE], sizeof(buf) - LWS_PRE, 
                                     msg, (long)time(NULL));
                
                if (msg_len > 0) {
                    int result = lws_write(wsi, &buf[LWS_PRE], msg_len, LWS_WRITE_TEXT);
                    if (result < 0) {
                        printf("[WEBSOCKET ERROR] Write failed: %d\n", result);
                    } else {
                        printf("[WEBSOCKET] Sent pong response\n");
                    }
                }
            }
            break;
            
        case LWS_CALLBACK_WSI_CREATE:
            printf("[WEBSOCKET] New connection being established\n");
            break;
            
        case LWS_CALLBACK_WSI_DESTROY:
            printf("[WEBSOCKET] Connection being destroyed\n");
            break;
            
        case LWS_CALLBACK_FILTER_PROTOCOL_CONNECTION:
            printf("[WEBSOCKET] Filtering protocol connection\n");
            break;
            
        case LWS_CALLBACK_PROTOCOL_INIT:
            printf("[WEBSOCKET] Protocol initialized\n");
            break;
            
        case LWS_CALLBACK_PROTOCOL_DESTROY:
            printf("[WEBSOCKET] Protocol destroyed\n");
            break;

        default:
            // Log other events for debugging
            printf("[WEBSOCKET] Event: %d\n", reason);
            break;
    }
    return 0;
}

void broadcast_to_clients(const char* message, size_t len) {
    printf("[WEBSOCKET] Broadcasting message of length %zu to %d clients\n", len, client_count);
    
    // Pre-allocate buffer with LWS_PRE padding
    unsigned char *buf = (unsigned char*)malloc(LWS_PRE + len);
    if (!buf) {
        printf("[WEBSOCKET ERROR] Failed to allocate broadcast buffer\n");
        return;
    }

    // Copy message into buffer after LWS_PRE padding
    memcpy(buf + LWS_PRE, message, len);
    
    for (int i = 0; i < client_count; i++) {
        if (ws_clients[i]) {
            printf("[WEBSOCKET] Sending to client %d\n", i);
            
            // Write with proper length and type
            int result = lws_write(ws_clients[i], buf + LWS_PRE, len, LWS_WRITE_TEXT);
            
            if (result < 0) {
                printf("[WEBSOCKET ERROR] Write failed for client %d: %d\n", i, result);
            } else {
                printf("[WEBSOCKET] Successfully sent %d bytes to client %d\n", result, i);
            }
            
            // Force pending writes to be sent
            lws_callback_on_writable(ws_clients[i]);
        }
    }
    
    free(buf);
    
    if (client_count == 0) {
        printf("[WEBSOCKET] No clients connected to broadcast to!\n");
    }
} 