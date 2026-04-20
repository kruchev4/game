// chat-server/main.go
package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local development
	},
}

// Client wraps the WebSocket connection.
type Client struct {
	conn *websocket.Conn
}

// Global State
var (
	// A map of all connected clients
	clients = make(map[*Client]bool)
	// Mutex locks the map so multiple threads don't write to it at the exact same time
	clientsMu sync.Mutex
	broadcast = make(chan []byte)
)

func main() {
	// 1. Define the WebSocket route
	http.HandleFunc("/chat", handleConnections)

	// 2. Start the broadcaster in a separate thread (Goroutine)
	go handleMessages()

	// 3. Start the server
	log.Println("[Chat Server] Go WebSocket Chat Server started on :8081")
	err := http.ListenAndServe(":8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

// This function runs every time a new player connects to the chat server
func handleConnections(w http.ResponseWriter, r *http.Request) {
	// Upgrade the HTTP request to a WebSocket
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer ws.Close() // Ensure the socket closes when the function finishes

	client := &Client{conn: ws}

	// add the new client to the global map
	clientsMu.Lock()
	clients[client] = true
	clientsMu.Unlock()

	log.Println("[Chat Server] New player connected to Global Chat")

	// Infinite loop: Wait for messages from this specific player
	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Println("[Chat Server] Player disconnected")
			// Safely remove them from the map
			clientsMu.Lock()
			delete(clients, client)
			clientsMu.Unlock()
			break
		}
		// Shove the message into the broadcast channel for the other thread to handle
		broadcast <- msg
	}
}

// This function runs in its own thread, waiting for messages in the broadcast pipe
func handleMessages() {
	for {
		// Grab the next message from the pipe
		msg := <-broadcast

		// Lock the clients map so and loop through it
		clientsMu.Lock()
		for client := range clients {
			// Send the message to everyone
			err := client.conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Printf("[Chat Server] Error writing to client: %v", err)
				client.conn.Close()
				delete(clients, client)
			}
		}
		clientsMu.Unlock()
	}
}
