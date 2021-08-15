import { Server } from 'http';
import websocket from 'socket.io';

import { ChatEvent } from '../types/chat';

let socket: websocket.Server;
const messageList: string[] = [];
const roomList = new Map<string, Room>();

const setRtc = (client: websocket.Socket) => {
  client.on('createRoom', (_, callback) => {
    callback('zoom');
  });

  client.on('join', (data: { room_id: string; name: string }, callback) => {
    const { room_id, name } = data;
    const peer = new Peer(client.id, name);
    const room = roomList.get('zoom');
    if (room) {
      room.addPeer(peer);
      callback(room.toJson());
      console.log('---user joined---"${room_id}": ${name}');
    } else {
      console.error('failed to join room');
    }
  });

  client.on('getProducers', () => {
    const room = roomList.get('zoom');
    if (room == null) return;
    const peer = room.getPeers().get(client.id);
    if (peer) {
      console.log('---get producers--- name:${peer.getName()}');
      //send all the current producer to newly joined member
      const producerList = room.getProducerListForPeer(client.id);

      socket.emit('newProducers', producerList);
    }
  });

  client.on('getRouterRtpCapabilities', (_, callback) => {
    const room = roomList.get('zoom');
    if (room == null) return;
    const peer = room.getPeers().get(client.id);

    if (peer) {
      console.log('---get RouterRtpCapabilities--- name: ${peer.getName()}');
      try {
        callback(room.getRtpCapabilities());
      } catch (e) {
        callback({
          error: e.message,
        });
      }
    }
  });
  client.on('createWebRtcTransport', async (_, callback) => {
    const room = roomList.get('zoom');
    if (room == null) return;
    const peer = room.getPeers().get(client.id);
    if (peer) {
      console.log('---creae webrtc transport--- name: ${peer.getName()}');
      try {
        const { params } = await room.createWebRtcTransport(client.id);
        callback(params);
      } catch (err) {
        console.error(err);
        callback({
          error: err.message,
        });
      }
    }
  });

  client.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
    const room = roomList.get('zoom');
    if (room == null) return;
    const peer = room.getPeers.get(client.id);
    if (peer) {
      console.log('---connect transport--- name: ${peer.getName()}');
      await room.connectPeerTransport(client.id, transport_id, dtlsParameters);
      callback('success');
    }
  });

  client.on('produce', async ({ kind, rtpParameters, producerTransportId }, callback) => {
    const room = roomList.get('zoom');
    if (room == null) {
      callback({ error: 'not is a room' });
      return;
    }
    const producerId = await room.produce(client.id, producerTransportId, rtpParameters, kind);
    const peer = room.getPeers().get(client.id);
    if (peer) {
      console.log('---produce--- type: ${kind} name: ${peer.getName()} id: ${producerId}');
    }
    callback(producerId);
  });
};

export const initWebSocket = (server: Server): void => {
  socket = new websocket.Server(server, {
    path: '/chat',
    serveClient: false,
    allowEIO3: true,
    cors: { origin: true, credentials: true },
  });
  socket.on(ChatEvent.CONNECTION, (client: websocket.Socket) => {
    console.log('connected', client.id);
    client.join('zoomw');
    client.on(ChatEvent.NEW_MESSAGE, (message: string) => {
      messageList.push(message);
      socket.to('zoom').emit(ChatEvent.GET_MESSAGE, message);
    });

    setRtc(client);

    client.emit(ChatEvent.GET_ALL_MESSAGE, messageList);
  });
  socket.on(ChatEvent.DISCONNECT, () => {
    console.log('closed');
  });
};
