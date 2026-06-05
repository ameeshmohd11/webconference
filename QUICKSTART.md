# NEXUS — Quick Start Guide (Windows)

## 5-Minute Setup

### 1. Install Node.js
- Download from https://nodejs.org (LTS recommended)
- Run installer, select "Add to PATH"
- Verify installation:
  ```powershell
  node --version
  npm --version
  ```

### 2. Install Dependencies
Open PowerShell in the project folder and run:
```powershell
npm install
```

### 3. Start Server
```powershell
npm start
```

You should see:
```
🚀 NEXUS Server running on port 3000
📍 http://localhost:3000
```

### 4. Open in Browser
- Go to `http://localhost:3000`
- Create a room or join with a room ID
- For testing on the same device, open another browser tab/window

---

## Troubleshooting

### "npm command not found"
- Node.js not in PATH; restart PowerShell after installation
- Or restart your computer

### "Port 3000 in use"
Change port in `.env`:
```
PORT=3001
```

### "module not found" error
Ensure you ran `npm install` in the project folder

### "Camera permission denied"
- Windows Privacy Settings → Camera/Microphone → Allow
- Or restart browser after granting permission

---

## Development Mode (Auto-reload)

Install nodemon first:
```powershell
npm install -g nodemon
```

Then run:
```powershell
npm run dev
```

Changes to `server.js` or `client.js` will auto-restart the server.

---

## Testing

### Same Device (Different Tabs)
1. Open http://localhost:3000 in Tab A
2. Click "Create room" — copy the room ID
3. Open http://localhost:3000 in Tab B
4. Paste room ID and click "Join"

### Different Devices (Same Network)
1. Find your PC's IP: `ipconfig` (look for IPv4 Address)
2. On other device, go to `http://YOUR_IP:3000`
3. Create or join room

### Testing from Internet
- Use ngrok: `ngrok http 3000`
- Share the provided URL

---

## Backend Features

✅ **Implemented**
- Room creation/joining
- WebRTC signaling (offer/answer/ICE)
- Text chat relay
- In-memory room management
- Health check API

🚀 **Ready to Add**
- Persistent database (MongoDB/PostgreSQL)
- User authentication
- Call history/analytics
- TURN server deployment
- Rate limiting
- Admin dashboard

---

## File Structure Explanation

| File | Purpose |
|------|---------|
| `server.js` | Express + Socket.io backend |
| `client.js` | WebSocket signaling logic |
| `videocall.html` | Frontend UI and WebRTC |
| `package.json` | Node dependencies |
| `.env.example` | Configuration template |
| `README.md` | Full documentation |

---

## Next Steps

1. **Deployment**: Push to Heroku, AWS, or your preferred host
2. **Customization**: Add branding, themes, custom STUN/TURN servers
3. **Features**: Recording, group calling, user profiles
4. **Analytics**: Track calls, uptime, performance

See `README.md` for detailed information.
