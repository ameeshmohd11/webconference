/* ───────────────────────────────────────────
   NEXUS — WebRTC Client (WebSocket Signaling)
   Connects to backend server for real signaling
─────────────────────────────────────────── */

const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

let localStream = null;
let peerConnection = null;
let dataChannel = null;
let roomId = null;
let isHost = false;
let micOn = true;
let callStartTime = null;
let timerInterval = null;
let chatOpen = false;
let socket = null;

// Connect to WebSocket server
function initSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${protocol}//${window.location.host}`;
  
  socket = io(socketUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    showToast('🔌 Connected to server');
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    showToast('📵 Disconnected from server');
  });

  // Signal events - Set up EARLY (before rooms created)
  socket.on('offer', async (data) => {
    console.log('[Signal] Received offer from:', data.from);
    if (!peerConnection) {
      console.warn('[Signal] PeerConnection not ready, waiting...');
      setTimeout(() => socket.emit('offer-ack'), 100); // Signal ready
      return;
    }
    if (peerConnection && !isHost) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer: peerConnection.localDescription });
        console.log('[Signal] Answer sent');
      } catch (e) {
        console.error('[Signal] Error handling offer:', e);
      }
    }
  });

  socket.on('answer', async (data) => {
    console.log('[Signal] Received answer from:', data.from);
    if (peerConnection && isHost) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('[Signal] Answer set');
      } catch (e) {
        console.error('[Signal] Error handling answer:', e);
      }
    }
  });

  socket.on('ice-candidate', async (data) => {
    if (peerConnection && data.candidate) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  });

  socket.on('user-joined', (data) => {
    console.log('[Room] Guest joined:', data.socketId);
    document.getElementById('waitingOverlay').style.display = 'none';
    showToast('👤 Participant joined');
  });

  socket.on('user-left', (data) => {
    console.log('[Room] User left:', data.socketId);
    document.getElementById('waitingOverlay').style.display = 'flex';
    showToast('👤 Participant left');
  });

  socket.on('chat-message', (data) => {
    console.log('[Chat] Message from:', data.from);
    renderMsg(data.text, false);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket Error]:', error);
    showToast('⚠ Connection error');
  });
}

/* ─── Init local media (audio only) ─── */
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('[Audio] Local stream initialized');
  } catch (e) {
    showToast('⚠ Microphone unavailable');
  }
}

/* ─── Create room (host) ─── */
async function createRoom() {
  if (!socket || !socket.connected) {
    showToast('⚠ Not connected to server');
    return;
  }

  socket.emit('create-room', (response) => {
    if (!response.success) {
      showToast('❌ Failed to create room');
      return;
    }

    roomId = response.roomId;
    isHost = true;
    enterRoom();
    setupPeerConnection();
    showToast('📋 Room created — share the ID!');
  });
}

/* ─── Join room (guest) ─── */
async function joinRoom(id) {
  if (!socket || !socket.connected) {
    showToast('⚠ Not connected to server');
    return;
  }

  roomId = id.trim().toLowerCase();
  isHost = false;

  socket.emit('join-room', roomId, (response) => {
    if (!response.success) {
      showToast('❌ ' + (response.error || 'Failed to join room'));
      return;
    }

    enterRoom();
    setupPeerConnection();
    startTimer();
    showToast('✅ Connected!');
  });
}

/* ─── Setup PeerConnection ─── */
function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  if (localStream) {
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
  }

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', { candidate: event.candidate });
    }
  };

  // Handle remote stream (audio only)
  peerConnection.ontrack = (e) => {
    console.log('[Stream] Received remote track:', e.track.kind);
    showToast('🔊 Remote participant connected');
    document.getElementById('waitingOverlay').style.display = 'none';
  };

  // Handle connection state changes
  peerConnection.oniceconnectionstatechange = () => {
    console.log('[PC] ICE connection state:', peerConnection.iceConnectionState);
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.iceConnectionState)) {
      showToast('📵 Peer disconnected');
      setStatus('disconnected');
      document.getElementById('waitingOverlay').style.display = 'flex';
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('[PC] Connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      setStatus('connected');
      startTimer();
    }
  };

  // Create or handle data channel
  if (isHost) {
    dataChannel = peerConnection.createDataChannel('chat');
    setupDataChannel(dataChannel);
  } else {
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel(dataChannel);
    };
  }

  // Create and send offer if host
  if (isHost) {
    createAndSendOffer();
  }

  setStatus('connecting');
}

async function createAndSendOffer() {
  try {
    // Give PeerConnection a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Emit offer with retry logic
    socket.emit('offer', { offer: peerConnection.localDescription }, (ack) => {
      console.log('[Signal] Offer delivered and acknowledged');
    });
    console.log('[Signal] Sent offer');
  } catch (e) {
    console.error('Error creating offer:', e);
    showToast('⚠ Error creating offer');
  }
}

/* ─── Enter room UI ─── */
function enterRoom() {
  document.getElementById('lobby').classList.remove('active');
  document.getElementById('room').classList.add('active');
  document.getElementById('roomLabel').textContent = roomId;
  document.getElementById('waitingRoomId').textContent = roomId;
}

/* ─── Media controls ─── */
function toggleMic() {
  micOn = !micOn;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
  const btn = document.getElementById('micBtn');
  const icon = document.getElementById('micIcon');
  btn.classList.toggle('active', micOn);
  if (micOn) {
    icon.innerHTML = '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
  } else {
    icon.innerHTML = '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><line x1="3" y1="3" x2="21" y2="21"/>';
  }
  sendData({ type: 'mute', muted: !micOn });
}

function toggleCam() {
  // Video disabled - audio only mode
}

/* ─── Data channel / chat ─── */
function setupDataChannel(dc) {
  dc.onopen = () => console.log('[DataChannel] Open');
  dc.onclose = () => console.log('[DataChannel] Closed');
  dc.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'chat') renderMsg(msg.text, false);
      if (msg.type === 'mute') {
        const badge = document.getElementById('remoteMuteBadge');
        badge.classList.toggle('show', msg.muted);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  };
}

function sendData(obj) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify(obj));
  } else {
    // Fallback to server relay if data channel not ready
    socket.emit('chat-message', { text: JSON.stringify(obj) });
  }
}

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chatPanel').classList.toggle('open', chatOpen);
  document.getElementById('chatBtn').classList.toggle('active', chatOpen);
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  // Send via data channel
  sendData({ type: 'chat', text });
  // Also relay via server
  socket.emit('chat-message', { text });

  renderMsg(text, true);
  input.value = '';
}

function renderMsg(text, mine) {
  const wrap = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg' + (mine ? ' mine' : '');
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `<div class="msg-meta">${mine ? 'You' : 'Remote'} · ${time}</div><div class="msg-text">${escHtml(text)}</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  if (!chatOpen) showToast('💬 ' + (text.length > 30 ? text.slice(0, 30) + '…' : text));
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Timer ─── */
function startTimer() {
  if (timerInterval) return; // Prevent multiple timers
  callStartTime = Date.now();
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - callStartTime) / 1000);
    const m = Math.floor(s / 60);
    document.getElementById('callTimer').textContent =
      String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}

/* ─── Status dot ─── */
function setStatus(state) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot ' + state;
}

/* ─── Copy room ID ─── */
function copyRoomId() {
  navigator.clipboard.writeText(roomId).then(() => showToast('🔗 Room ID copied!'));
}

/* ─── Leave ─── */
function leaveCall() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  // Reset UI
  document.getElementById('room').classList.remove('active');
  document.getElementById('lobby').classList.add('active');
  document.getElementById('waitingOverlay').style.display = 'flex';
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('chatPanel').classList.remove('open');
  chatOpen = false;
  micOn = true;
  document.getElementById('micBtn').classList.add('active');
  setStatus('');

  roomId = null;
  isHost = false;
}

/* ─── Toast ─── */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─── Button handlers ─── */
document.getElementById('createBtn').addEventListener('click', createRoom);
document.getElementById('joinBtn').addEventListener('click', () => {
  const id = document.getElementById('roomInput').value;
  if (!id.trim()) { showToast('⚠ Enter a room ID'); return; }
  joinRoom(id);
});
document.getElementById('roomInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('joinBtn').click();
});

/* ─── Draggable PiP ─── */
(function() {
  const pip = document.getElementById('pipLocal');
  let dragging = false, ox, oy;
  pip.addEventListener('mousedown', e => {
    dragging = true;
    pip.style.cursor = 'grabbing';
    ox = e.clientX - pip.offsetLeft;
    oy = e.clientY - pip.offsetTop;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let x = e.clientX - ox, y = e.clientY - oy;
    x = Math.max(0, Math.min(window.innerWidth - pip.offsetWidth, x));
    y = Math.max(0, Math.min(window.innerHeight - pip.offsetHeight, y));
    pip.style.right = 'auto';
    pip.style.bottom = 'auto';
    pip.style.left = x + 'px';
    pip.style.top = y + 'px';
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    pip.style.cursor = 'grab';
  });
})();

/* ─── Boot ─── */
initSocket();
initMedia();
