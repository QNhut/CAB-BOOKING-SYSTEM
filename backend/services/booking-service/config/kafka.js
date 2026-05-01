import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");

export const KAFKA_BOOKING_TOPIC = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
export const KAFKA_RIDE_TOPIC    = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";

export function createProducer(clientId = "booking-service") {
  const kafka = new Kafka({ clientId, brokers });
  return kafka.producer();
}

export function createConsumer(clientId, groupId) {
  const kafka = new Kafka({ clientId, brokers });
  return kafka.consumer({ groupId });
}
