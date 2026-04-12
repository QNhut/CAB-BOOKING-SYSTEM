import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
export const KAFKA_BOOKING_TOPIC = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
export const KAFKA_RIDE_TOPIC    = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";

export function createProducer() {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "booking-service",
    brokers,
  });
  return kafka.producer();
}