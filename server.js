require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS configuration for production
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Room management
const rooms = new Map(); // { roomId: { host: socketId, guest: socketId, createdAt, ... } }
const socketToRoom = new Map(); // { socketId: roomId }

// API endpoint to get room info
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomId,
    participants: Object.keys(room.participants || {}).length,
    createdAt: room.createdAt,
    isOpen: !room.isFull
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'videocall.html'));
});

// Socket.io events
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`);

  // Create new room
  socket.on('create-room', (callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      roomId,
      host: socket.id,
      participants: { [socket.id]: { role: 'host', socketId: socket.id } },
      createdAt: new Date(),
      messages: []
    });
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);
    console.log(`[Room] Created: ${roomId} (Host: ${socket.id})`);
    callback({ success: true, roomId });
  });

  // Join existing room
  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    // Check if room is full
    if (Object.keys(room.participants || {}).length >= 2) {
      callback({ success: false, error: 'Room is full' });
      return;
    }

    // Add participant
    room.participants = room.participants || {};
    room.participants[socket.id] = { role: 'guest', socketId: socket.id, joinedAt: new Date() };
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    // Notify host about new guest
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      role: 'guest'
    });

    console.log(`[Room] ${roomId} - Guest joined: ${socket.id}`);
    callback({ 
      success: true, 
      roomId,
      host: room.host,
      participants: Object.keys(room.participants)
    });
  });

  // Signal events (offer, answer, ICE candidates)
  socket.on('offer', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('offer', {
        from: socket.id,
        offer: data.offer
      });
      console.log(`[Signal] Offer: ${socket.id} → room ${roomId}`);
    }
  });

  socket.on('answer', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('answer', {
        from: socket.id,
        answer: data.answer
      });
      console.log(`[Signal] Answer: ${socket.id} → room ${roomId}`);
    }
  });

  socket.on('ice-candidate', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('ice-candidate', {
        from: socket.id,
        candidate: data.candidate
      });
    }
  });

  // Chat messaging
  socket.on('chat-message', (data) => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      const message = {
        from: socket.id,
        text: data.text,
        timestamp: new Date(),
        id: uuidv4()
      };
      
      if (room) {
        room.messages = room.messages || [];
        room.messages.push(message);
      }

      // Broadcast to all in room
      io.to(roomId).emit('chat-message', message);
      console.log(`[Chat] ${roomId}: ${socket.id} sent message`);
    }
  });

  // Get room history
  socket.on('get-room-state', (roomId, callback) => {
    const room = rooms.get(roomId);
    if (room) {
      callback({
        roomId,
        participants: Object.keys(room.participants || {}),
        messageCount: (room.messages || []).length
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    
    if (roomId) {
      const room = rooms.get(roomId);
      
      if (room && room.participants) {
        delete room.participants[socket.id];
        
        // Notify others in room
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          remainingParticipants: Object.keys(room.participants)
        });

        // Clean up empty rooms after 5 minutes
        if (Object.keys(room.participants).length === 0) {
          setTimeout(() => {
            if (Object.keys(room.participants).length === 0) {
              rooms.delete(roomId);
              console.log(`[Room] Deleted (empty): ${roomId}`);
            }
          }, 5 * 60 * 1000);
        }
      }
    }

    socketToRoom.delete(socket.id);
    console.log(`[${new Date().toISOString()}] User disconnected: ${socket.id}`);
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`[Socket Error] ${socket.id}:`, error);
  });
});

// Helper function to generate room ID
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segment = (n) => 
    Array.from({ length: n }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  return `nexus-${segment(4)}-${segment(4)}`;
}

// Start server
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

server.listen(PORT, () => {
  console.log(`\n🚀 NEXUS Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🔌 WebSocket enabled for real-time signaling`);
  console.log(`📦 Environment: ${NODE_ENV}`);
  console.log(`🔐 CORS origins: ${allowedOrigins.join(', ')}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
