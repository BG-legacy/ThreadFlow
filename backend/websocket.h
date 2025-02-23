#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include <libwebsockets.h>
#include <stdio.h>
#include <string.h>

#define MAX_CLIENTS 100

// Function declarations
void broadcast_to_clients(const char* message, size_t len);
int ws_callback(struct lws *wsi, enum lws_callback_reasons reason,
                void *user, void *in, size_t len);
struct lws_context* get_ws_context(void);
void set_ws_context(struct lws_context* context);

#endif // WEBSOCKET_H 