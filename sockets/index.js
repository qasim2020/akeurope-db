const { Server } = require('socket.io');

let io; 

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', 
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('A client disconnected:', socket.id);
    });

    socket.on('new-notification', (data) => {
      console.log('Received new-notification event:', data);
  
      io.emit('new-notification', { message: 'New notification from port 3007' });
  
      console.log('Notification emitted');
    });
  });

}

function getSocket() {
  if (!io) throw new Error('Socket.io not initialized!');
  return io;
}

module.exports = { initSocket, getSocket };
