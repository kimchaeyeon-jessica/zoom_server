import { Consumer } from 'mediasoup/lib/Consumer';
import { Producer } from 'mediasoup/lib/Producer';
import { MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/lib/RtpParameters';
import { DtlsParameters, WebRtcTransport } from 'mediasoup/lib/WebRtcTransport';

export default class Peer {
  private readonly id: string;
  private readonly name: string;
  private transports: Map<string, WebRtcTransport>;
  private producers: Map<string, Producer>;
  private consumers: Map<string, Consumer>;

  constructor(socketId: string, name: string) {
    this.id = socketId;
    this.name = name;
    this.transports = new Map<string, WebRtcTransport>();
    this.consumers = new Map<string, Consumer>();
    this.producers = new Map<string, Producer>();
  }

  public addTransport(transport: WebRtcTransport): void {
    this.transports.set(transport.id, transport);
  }

  public async connectTransport(transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    if (!transportId) return;
    const transport = this.transports.get(transportId);
    if (transport) {
      await transport.connect({
        dtlsParameters,
      });
    }
  }

  public async createProducer(producerTransportId: string, rtpParameters: RtpParameters, kind: MediaKind): Promise<Producer | null> {
    const transport = this.transports.get(producerTransportId);
    if (!transport) return null;

    const producer: Producer = await transport.produce({
      kind,
      rtpParameters,
    });

    this.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log(`---producer transport close--- name: ${this.name} consumerId: ${producer.id}`);
      producer.close();
      this.producers.delete(producer.id);
    });

    return producer;
  }

  public getProducers(): Map<string, Producer> {
    return this.producers;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getConsumers(): Map<string, Consumer> {
    return this.consumers;
  }

  public async createConsumer(consumerTransportId: string, producerId: string, rtpCapabilities: RtpCapabilities) {
    const consumerTransport = this.transports.get(consumerTransportId);

    if (!consumerTransport) {
      return null;
    }

    let consumer: Consumer;
    try {
      consumer = await consumerTransport.consume({
        producerId,
        rtpCapabilities,
        paused: false, // producer.kind === 'video',
      });
    } catch (error) {
      console.error('consume failed', error);
      return null;
    }

    if (consumer.type === 'simulcast') {
      await consumer.setPreferredLayers({
        spatialLayer: 2,
        temporalLayer: 2,
      });
    }

    this.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      console.log(`---consumer transport close--- name: ${this.name} consumerId: ${consumer.id}`);
      this.consumers.delete(consumer.id);
    });

    return {
      consumer,
      params: {
        producerId,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    };
  }

  public closeProducer(producerId: string): void {
    try {
      const producer: Producer | undefined = this.producers.get(producerId);
      if (producer == null) {
        return;
      }
      producer.close();
    } catch (e) {
      console.warn(e);
    }

    this.producers.delete(producerId);
  }

  public getProducer(producerId: string): Producer | undefined {
    return this.producers.get(producerId);
  }

  public close(): void {
    this.transports.forEach((transport) => transport.close());
  }

  public removeConsumer(consumerId: string): void {
    this.consumers.delete(consumerId);
  }
}
