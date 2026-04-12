#!/bin/sh
set -e

echo "Waiting for Kafka to be ready..."
sleep 10

echo "Creating Kafka topics..."
/opt/kafka/bin/kafka-topics.sh --create \
  --bootstrap-server kafka:9092 \
  --topic taxi.bookings \
  --partitions 3 \
  --replication-factor 1 \
  --if-not-exists

/opt/kafka/bin/kafka-topics.sh --create \
  --bootstrap-server kafka:9092 \
  --topic taxi.rides \
  --partitions 3 \
  --replication-factor 1 \
  --if-not-exists

/opt/kafka/bin/kafka-topics.sh --create \
  --bootstrap-server kafka:9092 \
  --topic taxi.payments \
  --partitions 2 \
  --replication-factor 1 \
  --if-not-exists

echo "Topics created successfully!"
/opt/kafka/bin/kafka-topics.sh --list --bootstrap-server kafka:9092
