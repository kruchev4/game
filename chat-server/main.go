package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Global State
var (
	clients   = make(map[*websocket.Conn]string) // Map the socket to the Player's Name
	names     = make(map[string]*websocket.Conn) // Map the Player's Name to their socket
	clientsMu sync.Mutex
)

// Define the exact shape of our JSON payload
type ChatMessage struct {
	Name    string `json:"name"`
	Text    string `json:"text"`
	To      string `json:"to,omitempty"`      // The target player (if it's a whisper)
	Private bool   `json:"private,omitempty"` // Flag for the frontend to color it purple
}

func main() {
	http.HandleFunc("/chat", handleConnections)
	log.Println("[Chat Server] Go WebSocket Chat Server started on :8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	// Add the anonymous socket to our map
	clientsMu.Lock()
	clients[ws] = ""
	clientsMu.Unlock()

	for {
		var msg ChatMessage

		err := ws.ReadJSON(&msg)
		if err != nil {
			// Player disconnected — clean up both maps
			clientsMu.Lock()
			playerName := clients[ws]
			delete(clients, ws)
			delete(names, playerName)
			clientsMu.Unlock()
			break
		}

		clientsMu.Lock()

		// Register the player's name the very first time they send a message
		if clients[ws] == "" && msg.Name != "" {
			clients[ws] = msg.Name
			names[msg.Name] = ws
		}

		// Routing Logic: Is this a Direct Message?
		if msg.To != "" {
			targetConn, exists := names[msg.To]
			if exists {
				msg.Private = true
				targetConn.WriteJSON(msg)

				// Echo it back to the sender so they can see their own outgoing whisper
				if targetConn != ws {
					ws.WriteJSON(msg)
				}
			} else {
				// Tell the sender the player isn't online
				ws.WriteJSON(ChatMessage{Name: "System", Text: msg.To + " is offline or doesn't exist.", Private: true})
			}
		} else {
			// Global Broadcast
			for conn := range clients {
				conn.WriteJSON(msg)
			}
		}

		clientsMu.Unlock()
	}
}
