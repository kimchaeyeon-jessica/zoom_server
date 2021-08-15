import { Worker } from 'mediasoup/lib/Worker';
import { Server, Socket } from 'socket.io';
import { Router, RouterOptions } from 'mediasoup/lib/Router';
import { MediaKind, RtpCapabilities, RtpCodecCapability, RtpParameters } from 'mediasoup/lib/RtpParameters';
import { Producer } from 'mediasoup/lib/Producer';
import { DtlsParameters } from 'mediasoup/lib/WebRtcTransport';
import { Consumer } from 'mediasoup/lib/Consumer';
import config from '../../config';
import Peer from './peer';

export default class Room {
  private readonly id: string;
  private readonly peers: Map<string, Peer>;
  private io: Server;
  private router?: Router;

  constructor(roomId: string, worker: Worker, io: Server) {
    this.id = roomId;
    // @ts-ignore
    const { mediaCodecs }: RtpCodecCapability[] = config.mediasoup.router as RouterOptions;
    worker
      .createRouter({
        mediaCodecs,
      })
      .then((router) => {
        this.router = router;
      });

    this.peers = new Map<string, Peer>();
    this.io = io;
  }

  public addPeer(peer: Peer): void {
    this.peers.set(peer.getId(), peer);
  }

  public getProducerListForPeer(socketId: string): { producerId: string }[] {
    const producerList: { producerId: string }[] = [];
    this.peers.forEach((peer) => {
      peer.getProducers().forEach((producer: Producer) => {
        producerList.push({
          producerId: producer.id,
        });
      });
    });
    return producerList;
  }

  getRtpCapabilities(): RtpCapabilities | null {
    if (this.router) {
      return this.router.rtpCapabilities;
    }
    return null;
  }

  async createWebRtcTransport(socketId: string): Promise<any | null> {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } = config.mediasoup.webRtcTransport;
    if (this.router == null) return null;
    const peer = this.peers.get(socketId);
    if (peer == null) return null;

    const transport = await this.router.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });
    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {}
    }

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        console.log(`---transport close--- ${peer.getName()} closed`);
        transport.close();
      }
    });

    transport.on('close', () => {
      console.log(`---transport close--- ${peer.getName()} closed`);
    });
    console.log('---adding transport---', transport.id);
    peer.addTransport(transport);
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectPeerTransport(socketId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    if (!this.peers.has(socketId)) return;
    const peer = this.peers.get(socketId);
    if (peer == null) return;
    await peer.connectTransport(transportId, dtlsParameters);
  }

  async produce(socketId: string, producerTransportId: string, rtpParameters: RtpParameters, kind: MediaKind): Promise<string | null> {
    // handle undefined errors
    const peer = this.peers.get(socketId);
    if (peer == null) {
      return null;
    }

    const producer = await peer.createProducer(producerTransportId, rtpParameters, kind);

    if (producer != null) {
      this.broadCast(socketId, 'newProducers', [
        {
          producerId: producer.id,
          producer_socketId: socketId,
        },
      ]);
      return producer.id;
    }
    return null;
  }

  async consume(socketId: string, consumerTransportId: string, producerId: string, rtpCapabilities: RtpCapabilities) {
    // handle nulls
    if (
      this.router == null ||
      !this.router.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      console.error('can not consume');
      return;
    }

    const peer = this.peers.get(socketId);
    if (peer == null) return;

    const { consumer, params } = (await peer.createConsumer(consumerTransportId, producerId, rtpCapabilities)) as { consumer: Consumer; params: any };

    consumer.on('producerclose', () => {
      console.log(`---consumer closed--- due to producerclose event  name:${peer.getName()} consumerId: ${consumer.id}`);
      peer.removeConsumer(consumer.id);
      // tell client consumer is dead
      this.io.to(socketId).emit('consumerClosed', {
        consumerId: consumer.id,
      });
    });

    return params;
  }

  removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (peer == null) return;
    peer.close();
    this.peers.delete(socketId);
  }

  closeProducer(socketId: string, producerId: string) {
    const peer = this.peers.get(socketId);
    if (peer) {
      peer.closeProducer(producerId);
    }
  }

  broadCast(socketId: string, name: string, data: any) {
    for (const otherID of Array.from(this.peers.keys()).filter((id) => id !== socketId)) {
      this.send(otherID, name, data);
    }
  }

  send(socketId: string, name: string, data: any) {
    this.io.to(socketId).emit(name, data);
  }

  getPeers() {
    return this.peers;
  }

  toJson(): { id: string; peers: string } {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers]),
    };
  }
}
