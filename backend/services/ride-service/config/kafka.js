import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");

export const BOOKING_TOPIC = process.env.KAFKA_BOOKING_TOPIC || "taxi.bookings";
export const RIDE_TOPIC    = process.env.KAFKA_RIDE_TOPIC    || "taxi.rides";
export const GROUP_ID      = process.env.KAFKA_GROUP_ID      || "ride-service";

const kafka = new Kafka({ clientId: "ride-service", brokers });

export const producer = kafka.producer();
export const consumer = kafka.consumer({ groupId: GROUP_ID });
