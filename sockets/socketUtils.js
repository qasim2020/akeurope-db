function emitToUser(io, userId, event, payload) {
    const socket = findUserSocket(io, userId);
    if (socket) {
        socket.emit(event, payload);
    }
}

function findUserSocket(io, userId) {
    for (let [id, socket] of io.of('/').sockets) {
        if (socket.userId === userId) {
            return socket;
        }
    }
    return null;
}

module.exports = { emitToUser };
