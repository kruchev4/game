# Realm of Echoes: Global Chat Microservice

This is a standalone WebSocket microservice written in Go. It handles global chat broadcasts and direct player-to-player whispers, offloading this network traffic from the main Node.js game engine.

## Tech Stack
* **Language:** Go (Golang)
* **WebSocket Library:** Gorilla WebSocket (`github.com/gorilla/websocket`)
* **Deployment:** Multi-stage Docker build (Alpine Linux)

## Running Locally

**Option 1: Using Docker (Recommended)**
The chat server is integrated into the root `docker-compose.yml`. From the root of the repository, simply run:
`docker compose up -d --build chat`

The server will be available at `ws://localhost:8081/chat` (or your Dev VM's IP).

**Option 2: Running Bare-Metal**
If you have Go installed locally and want to test without Docker:
`cd chat-server`
`go run main.go`

## In-Game Usage & Controls

The chat system includes integrated UI hotkeys to ensure typing doesn't interfere with game engine movement (WASD).

### Hotkeys
* **`Enter`**: If chat is closed, opens the chat window and focuses the text box. If chat is open, sends the typed message.
* **`Escape`**: Instantly closes the chat window, drops focus, and returns keystrokes to the game engine.
* **`Click`**: The "💬 Chat" toggle button in the bottom right corner can also be clicked to open/close the window manually.

### Chat Commands
* **Global Chat:** Simply type a message and press `Enter` to broadcast to the entire realm.
* **Whisper (Direct Message):** Use the `/w` prefix followed by the exact player name to send a private, purple-colored message.
  * *Syntax:* `/w [PlayerName] [Your Message]`
  * *Example:* `/w kruchev Help, I am surrounded by goblins!`

## How It Works (For Frontend Integration)

The server listens on port `8081` at the `/chat` endpoint. It expects and returns JSON payloads.

### Connecting
Clients should open a WebSocket connection to:
`ws://<SERVER_IP>:8081/chat`

### JSON Payload Format
All messages sent to and received from the server use the following JSON structure:

```json
{
  "name": "Garflak",
  "text": "Hello world!",
  "to": "TargetPlayerName", 
  "private": true             
}
```

 - `name`: (Required) The name of the sender.
 - `text`: (Required) The message content.
 - `to`: (Optional) If included, the server will route this as a direct message (whisper) *only* to
    the player matching this name.
 - `private`: (Server-Generated) The server attaches this boolean to incoming whispers so the 
    client UI knows to color them differently.

 ## Development Notes
  - **Concurrency:** The server uses Go channels and a dedicated broadcasting Goroutine to ensure that
    one slow client cannot bottleneck the rest of the chat system.
  - **Statefulness:** The server stores a map of connected WebSocket clients ot their in-game names.
    It currently does *not* persist chat history to a database. If the container restarts, chat history is wiped.
