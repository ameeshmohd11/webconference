# NEXUS — Video Conferencing App

A modern, real-time peer-to-peer video conferencing application built with WebRTC and WebSocket signaling.

## Features

✨ **Core Features**
- 🎥 Real-time video and audio streaming
- 💬 In-call text chat with data channel fallback
- 🖥️ Screen sharing support
- 🎙️ Mute/unmute controls
- 📱 Responsive design (desktop & mobile)
- 🔗 Easy room sharing via copyable room IDs
- ⏱️ Call duration timer
- 🎨 Modern, minimalist UI

## Architecture

### Frontend
- **HTML5** — Semantic structure
- **CSS3** — Modern styling with CSS variables
- **WebRTC** — P2P video/audio and data channels
- **Socket.io Client** — Real-time signaling

### Backend
- **Node.js/Express** — HTTP server
- **Socket.io** — WebSocket signaling layer
- **In-memory room management** — Session handling

## Installation

### Prerequisites
- Node.js 14+ and npm
- Modern browser with WebRTC support (Chrome, Firefox, Edge, Safari)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to configure:
   - `PORT=3000` (or your preferred port)
   - `NODE_ENV=development`

3. **Start the server**
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Usage

### Starting a Call

1. **Create a Room** (Host)
   - Click "Create room" on the lobby
   - Share the generated room ID with others
   - Wait for someone to join

2. **Join a Room** (Guest)
   - Paste the room ID into the input field
   - Click "Join"
   - Accept camera/microphone permissions
   - Connection will establish automatically

### During the Call

- 🎤 **Mic Toggle** — Mute/unmute audio
- 📷 **Camera Toggle** — Turn video on/off
- 🖥️ **Screen Share** — Share your screen (one at a time)
- 💬 **Chat** — Send text messages to peer
- 🔗 **Invite** — Copy room ID to clipboard
- 📞 **Leave** — End the call

## Project Structure

```
video-conferencing-app/
├── server.js              # Express + Socket.io backend
├── client.js              # WebSocket signaling client
├── videocall.html         # Frontend UI and WebRTC logic
├── package.json           # Dependencies
└── .env.example           # Environment template
```

## API Endpoints

### REST

- `GET /` — Serve main HTML
- `GET /api/health` — Health check
- `GET /api/room/:roomId` — Room info (participants, createdAt, isOpen)

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create-room` | `callback` | Create new room |
| `join-room` | `roomId, callback` | Join existing room |
| `offer` | `{ offer }` | Send WebRTC offer |
| `answer` | `{ answer }` | Send WebRTC answer |
| `ice-candidate` | `{ candidate }` | Send ICE candidate |
| `chat-message` | `{ text }` | Send chat message |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `user-joined` | `{ socketId, role }` | New participant joined |
| `user-left` | `{ socketId, remainingParticipants }` | Participant left |
| `offer` | `{ from, offer }` | Received WebRTC offer |
| `answer` | `{ from, answer }` | Received WebRTC answer |
| `ice-candidate` | `{ from, candidate }` | Received ICE candidate |
| `chat-message` | `{ from, text, timestamp }` | Received chat message |

## Configuration

### STUN Servers
Currently uses Google's public STUN servers. For production, configure your own:

**server.js**
```javascript
const config = {
  iceServers: [
    { urls: 'stun:your-stun-server.com:3478' },
    { urls: 'turn:your-turn-server.com:3478', username: '...', credential: '...' }
  ]
};
```

### CORS Settings
**server.js** (line ~10)
```javascript
const io = socketIo(server, {
  cors: {
    origin: ['https://yourdomain.com'], // Add your domain
    methods: ['GET', 'POST']
  }
});
```

## Deployment

### Heroku
```bash
heroku create your-app-name
git push heroku main
heroku open
```

### Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### AWS/GCP/Azure
Deploy the `server.js` as a containerized service with:
- Auto-scaling enabled
- WebSocket support (ALB health checks)
- HTTPS/TLS termination
- TURN server for NAT traversal

## Troubleshooting

### "Camera/mic unavailable"
- Browser needs HTTPS in production (WebRTC requirement)
- Check browser permissions: Settings → Microphone/Camera
- Use localhost for HTTP in development

### "Room not found"
- Room IDs expire 5 minutes after last participant leaves
- Ensure both users are connected to the same backend server

### "No video appearing"
- Check browser console for WebRTC connection state
- Verify STUN/TURN server connectivity
- Test with another browser/device on different network

### "Connection timeout"
- Backend server may be down
- Check network/firewall rules
- Verify Socket.io connection in browser DevTools

## Performance

- **Room limit**: Unlimited (P2P only, no central media relay)
- **Max participants**: 2 (current design; scalable to SFU for group calls)
- **Signaling latency**: <100ms typical
- **Network bandwidth**: 2-5 Mbps per participant (1080p video)

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 51+ | ✅ Full |
| Firefox | 55+ | ✅ Full |
| Safari | 11+ | ✅ Full |
| Edge | 79+ | ✅ Full |
| Opera | 38+ | ✅ Full |

## Security

- **No recording** — Calls exist only in memory, not stored
- **E2E encrypted** — WebRTC uses DTLS for media encryption
- **CORS restricted** — Configure for your domain
- **No authentication** — Anyone with room ID can join (add later if needed)

For production, consider:
- Adding user authentication/authorization
- Implementing HTTPS/TLS
- Deploying TURN servers for NAT traversal
- Rate limiting on room creation
- Audit logging for compliance

## License

MIT License — Free for personal and commercial use

## Contributing

Contributions welcome! Areas for improvement:
- Group video calling (SFU architecture)
- Recording functionality
- User authentication
- Analytics/monitoring
- Mobile app (React Native)
- Call history
- User profiles

---

**Questions?** Open an issue or review the code comments in `server.js` and `client.js`
