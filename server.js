import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Increase timeouts for long-running connections
const httpServer = createServer({
  requestTimeout: 300000, // 5 minutes
  keepAliveTimeout: 300000, // 5 minutes
  headersTimeout: 305000, // Just above keepAliveTimeout
  timeout: 300000 // 5 minutes
}, app);

// Configure Socket.IO with improved timeout settings
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  pingTimeout: 60000, // 1 minute
  pingInterval: 25000, // 25 seconds
  connectTimeout: 60000, // 1 minute
  maxHttpBufferSize: 1e8,
  allowEIO3: true, // Enable compatibility mode
  path: '/socket.io'
});

const presentationWindows = new Map();
const controlPanels = new Map();
const messageQueue = new Map();
const heartbeats = new Map();

// Heartbeat check interval (every 30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000; // 1 minute timeout

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  heartbeats.set(socket.id, Date.now());

  // Send queued messages for this client
  const queuedMessages = messageQueue.get(socket.id);
  if (queuedMessages) {
    queuedMessages.forEach(msg => socket.emit(msg.event, msg.data));
    messageQueue.delete(socket.id);
  }

  // Update heartbeat on ping
  socket.on('ping', () => {
    heartbeats.set(socket.id, Date.now());
    socket.emit('pong');
  });

  socket.on('registerPresentation', (data, callback) => {
    try {
      console.log('Presentation window registered:', socket.id);
      presentationWindows.set(socket.id, { 
        connectedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      
      // Acknowledge registration
      if (typeof callback === 'function') {
        callback({ success: true });
      }

      // Notify control panels
      controlPanels.forEach((data, controlId) => {
        io.to(controlId).emit('presentationConnected', { id: socket.id });
      });
    } catch (error) {
      console.error('Error in registerPresentation:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

  socket.on('registerControl', (data, callback) => {
    try {
      console.log('Control panel registered:', socket.id);
      controlPanels.set(socket.id, { 
        connectedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error in registerControl:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

  socket.on('presentationUpdate', (data, callback) => {
    try {
      console.log('Update received from:', socket.id);
      
      // Broadcast to all presentation windows
      presentationWindows.forEach((data, windowId) => {
        const socket = io.sockets.sockets.get(windowId);
        if (socket && socket.connected) {
          socket.emit('presentationUpdate', data);
        } else {
          // Queue message for disconnected clients
          if (!messageQueue.has(windowId)) {
            messageQueue.set(windowId, []);
          }
          messageQueue.get(windowId).push({
            event: 'presentationUpdate',
            data
          });
        }
      });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (error) {
      console.error('Error in presentationUpdate:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message });
      }
    }
  });

  socket.on('disconnect', (reason) => {
    try {
      console.log('Client disconnected:', socket.id, 'Reason:', reason);
      
      if (presentationWindows.has(socket.id)) {
        presentationWindows.delete(socket.id);
        controlPanels.forEach((data, controlId) => {
          const socket = io.sockets.sockets.get(controlId);
          if (socket && socket.connected) {
            socket.emit('presentationDisconnected', { id: socket.id });
          }
        });
      }
      
      controlPanels.delete(socket.id);
      messageQueue.delete(socket.id);
      heartbeats.delete(socket.id);
    } catch (error) {
      console.error('Error in disconnect handler:', error);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
    socket.emit('error', { message: 'An error occurred' });
  });
});

// Heartbeat check (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  [...heartbeats.entries()].forEach(([socketId, lastBeat]) => {
    if (now - lastBeat > HEARTBEAT_TIMEOUT) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        console.log('Client timed out:', socketId);
        socket.disconnect(true);
      }
      heartbeats.delete(socketId);
    }
  });
}, HEARTBEAT_INTERVAL);

// Clean up stale connections periodically
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 5 * 60 * 1000; // 5 minutes

  [...presentationWindows.entries()].forEach(([id, data]) => {
    if (now - data.lastHeartbeat > staleTimeout) {
      presentationWindows.delete(id);
      console.log('Removed stale presentation window:', id);
    }
  });

  [...controlPanels.entries()].forEach(([id, data]) => {
    if (now - data.lastHeartbeat > staleTimeout) {
      controlPanels.delete(id);
      console.log('Removed stale control panel:', id);
    }
  });
}, 60000); // Check every minute

// Development proxy configuration
if (process.env.NODE_ENV !== 'production') {
  const proxy = createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
    logLevel: 'warn',
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.writeHead(502, {
        'Content-Type': 'text/plain'
      });
      res.end('Proxy error: ' + err.message);
    }
  });

  app.use((req, res, next) => {
    if (req.url.startsWith('/socket.io')) {
      next();
    } else {
      proxy(req, res, next);
    }
  });
} else {
  app.use(express.static(join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 3001;

// Start server with error handling
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
}).on('error', (error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  httpServer.close(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});