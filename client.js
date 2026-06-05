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
let micOn = true, camOn = true;
let screenSharing = false;
let screenStream = null;
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

  // Signal events
  socket.on('offer', async (data) => {
    console.log('[Signal] Received offer from:', data.from);
    if (peerConnection && !isHost) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { answer: peerConnection.localDescription });
    }
  });

  socket.on('answer', async (data) => {
    console.log('[Signal] Received answer from:', data.from);
    if (peerConnection && isHost) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
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
    document.getElementById('remoteVideo').srcObject = null;
    document.getElementById('remoteAvatar').classList.add('show');
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

/* ─── Init local media ─── */
async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localPreview').srcObject = localStream;
    document.getElementById('previewOff').style.display = 'none';
  } catch (e) {
    document.getElementById('previewOff').style.display = 'flex';
    showToast('⚠ Camera/mic unavailable');
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

  // Handle remote stream
  peerConnection.ontrack = (e) => {
    console.log('[Stream] Received remote track:', e.track.kind);
    const remoteVideo = document.getElementById('remoteVideo');
    remoteVideo.srcObject = e.streams[0];
    document.getElementById('waitingOverlay').style.display = 'none';
    document.getElementById('remoteAvatar').classList.remove('show');
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
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { offer: peerConnection.localDescription });
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

  // Set up PiP local video
  const pipVideo = document.getElementById('pipVideo');
  if (localStream) pipVideo.srcObject = localStream;
  document.getElementById('pipLocal').classList.add('show');
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
  camOn = !camOn;
  if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = camOn);
  document.getElementById('camBtn').classList.toggle('active', camOn);
  sendData({ type: 'cam', off: !camOn });
}

async function toggleScreen() {
  if (!screenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => stopScreen();
      document.getElementById('screenBtn').classList.add('active');
      screenSharing = true;
      showToast('🖥 Screen sharing started');
    } catch (e) {
      showToast('Screen share cancelled');
    }
  } else {
    stopScreen();
  }
}

async function stopScreen() {
  if (!screenSharing) return;
  if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
  if (peerConnection && localStream) {
    const camTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender && camTrack) await sender.replaceTrack(camTrack);
  }
  document.getElementById('screenBtn').classList.remove('active');
  screenSharing = false;
  showToast('🖥 Screen sharing stopped');
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
  if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  // Reset UI
  document.getElementById('room').classList.remove('active');
  document.getElementById('lobby').classList.add('active');
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('waitingOverlay').style.display = 'flex';
  document.getElementById('pipLocal').classList.remove('show');
  document.getElementById('callTimer').textContent = '00:00';
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('chatPanel').classList.remove('open');
  chatOpen = false;
  micOn = true;
  camOn = true;
  screenSharing = false;
  document.getElementById('micBtn').classList.add('active');
  document.getElementById('camBtn').classList.add('active');
  document.getElementById('screenBtn').classList.remove('active');
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
