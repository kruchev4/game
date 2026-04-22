# Realm of Echoes: Architecture & Control Flow

As of the Engine.js refactor, the client-side game architecture follows a strict decoupled Manager/System pattern. `Engine.js` acts solely as the central hub and game loop, while specialized managers handle specific domains.

## 1. Core Initialization (`Engine.js`)
`Engine.js` is responsible for loading world data, instantiating the Player, and spinning up all Systems and Managers. It runs the `requestAnimationFrame` loop, which simply calls `update()` on the active systems. It no longer contains explicit game logic.

## 2. Input & Action Flow
When a player clicks the mouse or presses a key, the flow of communication is strictly:
1. **`InputManager.js`**: Intercepts the raw hardware event (click/keypress). Translates it into a game intention (e.g., "Player wants to use ability in Slot 1" or "Player clicked an NPC").
2. **`ActionManager.js`**: Validates the intention. Checks if the player has enough mana, if the ability is on cooldown, and identifies the correct target.
3. **`CombatSystem.js`** (Local) or **`NetworkManager.js`** (Multiplayer): The action is queued locally or fired off as a packet to the authoritative server.

## 3. Event & Communication Flow
To prevent systems from being tightly coupled (e.g., the Combat System shouldn't need to know how to draw a UI log), we use a centralized event delegate pattern.

* **`GameEventHandler.js`**: The central nervous system. Systems (`CombatSystem`, `LootSystem`, `XPSystem`, `EffectSystem`) pass raw data objects to this handler (e.g., `{ type: "kill", target: "goblin" }`). 
* The handler parses these events and communicates with the `UIManager` (to show popups), the `AnimationSystem` (to show hit flashes), and the `CombatLog`.

## 4. Multiplayer Control Flow
In multiplayer mode, the server is strictly authoritative. 
* **`NetworkManager.js`**: Initializes the WebSocket connection and listens for server callbacks.
* When the server dictates a state change (e.g., `onNPCKilled` or `onStatUpdate`), the `NetworkManager` forcefully updates the local `Engine.js` arrays and relies on `GameEventHandler.js` to broadcast the visual results to the player.
* *Note on Race Conditions:* NetworkManager utilizes a `_deadNPCGhosts` cache to ensure delayed network packets (like dropped loot) can still find X/Y coordinates if the local heartbeat has already garbage-collected a dead entity.

## 5. UI & State Persistence
* **`UIManager.js`**: Completely decoupled from game logic. It only handles the instantiation, toggling, and destruction of React/DOM overlays (Inventory, Shops, Death Screen).
* **`SaveManager.js`**: Automatically ticks in the background. On a zone transition or manual save (F5), it gathers the current state from `Engine.js` and writes the JSON payload to the storage provider.
