export class ChatSystem {
  constructor(playerName) {
    this.playerName = playerName;
    this.messagesDiv = document.getElementById('chat-messages');
    this.inputField = document.getElementById('chat-input');
    this.container = document.getElementById('chat-container');
    this.toggleBtn = document.getElementById('chat-toggle-btn');

    this.isOpen = false; // Start with chat hidden

    // Automatically determine the correct IP address
    const host = window.location.hostname;
    this.ws = new WebSocket(`ws://${host}:8081/chat`);

    this.ws.onopen = () => {
      this.addMessage('System', 'Connected to Global Chat', '#00ff00');
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.private) {
        // Render whispers in purple
        this.addMessage(`[Whisper] ${msg.name}`, msg.text, '#d0b0ff');
      } else {
        this.addMessage(msg.name, msg.text);
      }
    };

    this.ws.onclose = () => {
      this.addMessage('System', 'Disconnected from chat.', '#ff0000');
    };

    // --- UI Toggle & Keybinds ---

    // Click the button to toggle
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        this.toggleChat();
        if (this.isOpen) this.inputField.focus();
      });
    }

    // Handle keys INSIDE the text box
    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.toggleChat(false);
        this.inputField.blur();
        this.inputField.value = '';
        e.preventDefault();
        e.stopPropagation(); // Stop the game menu from opening
        return;
      }

      if (e.key === 'Enter') {
        if (this.inputField.value.trim() !== '') {
          this.sendMessage(this.inputField.value.trim());
          this.inputField.value = '';
        } else {
          this.inputField.blur();
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Stop all other typing (WASD) from bleeding into the game movement
      e.stopPropagation();
    });

    this.inputField.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    // Handle keys OUTSIDE the text box (Global document)
    document.addEventListener('keydown', (e) => {
      // 1. Press Enter globally to open chat
      if (e.key === 'Enter' && document.activeElement !== this.inputField) {
        this.toggleChat(true);
        this.inputField.focus();
        e.preventDefault();
      }

      // 2. Press Escape globally to close chat (if it was left open)
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleChat(false);
        // stopImmediatePropagation prevents the game Engine from seeing the Esc key
        // so it won't pop open the main menu!
        e.stopImmediatePropagation();
      }
    });

    this.inputField.addEventListener('keydown', (e) => {
          e.stopPropagation(); // Stops the game engine from hearing the key down
        });
        this.inputField.addEventListener('keyup', (e) => {
          e.stopPropagation(); // Stops the game engine from hearing the key up
        });

    // Press Enter anywhere in the game to open chat
    document.addEventListener('keydown', (e) => {
      // Don't trigger if they are typing in another input (like character creation)
      if (e.key === 'Enter' && document.activeElement !== this.inputField) {
        if (!this.isOpen) {
          this.toggleChat();
        }
        this.inputField.focus();
        e.preventDefault();
      }
    });

    // Press Escape to close the chat instantly
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.isOpen = false;
        this.container.style.display = 'none';
        this.inputField.blur(); // Drop focus so movement keys work again
        this.inputField.value = ''; // Optional: clear whatever they were typing
      }
    });
  }

  toggleChat(forceState) {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    this.container.style.display = this.isOpen ? 'flex' : 'none';
  }

  sendMessage(text) {
      if (this.ws.readyState === WebSocket.OPEN) {
        let targetPlayer = "";
        let cleanText = text;

        // Intercept "/w PlayerName Message..."
        if (text.startsWith("/w ")) {
          const parts = text.split(" ");
          if (parts.length > 2) {
            targetPlayer = parts[1]; // Grab the name
            cleanText = parts.slice(2).join(" "); // Re-join the rest of the message
          }
        }

        const payload = JSON.stringify({
          name: this.playerName,
          text: cleanText,
          to: targetPlayer
        });
        this.ws.send(payload);
      }
    }

  addMessage(sender, text, color = '#aaa') {
    const el = document.createElement('div');
    el.innerHTML = `<strong style="color: ${color};">${sender}:</strong> <span>${text}</span>`;
    this.messagesDiv.appendChild(el);
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
  }
}
