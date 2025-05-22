// src/kafka/consumer.js
const { Kafka } = require('kafkajs');
const { userEventHandler } = require('./handlers/userEventHandler');

let kafka;
let consumer;
let isConnected = false;

/**
 * Initialize Kafka consumer
 */
async function initKafka() {
  if (!process.env.KAFKA_ENABLED || process.env.KAFKA_ENABLED !== 'true') {
    console.log('Kafka integration is disabled');
    return;
  }

  try {
    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'spellchecker-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_SASL_ENABLED === 'true' ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD
      } : undefined,
    });

    consumer = kafka.consumer({ 
      groupId: process.env.KAFKA_GROUP_ID || 'spellchecker-group' 
    });

    await consumer.connect();
    isConnected = true;
    console.log('Connected to Kafka');

    // Subscribe to user events topic
    const userEventsTopic = process.env.KAFKA_USER_EVENTS_TOPIC || 'user-events';
    await consumer.subscribe({ topics: [userEventsTopic], fromBeginning: false });

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const key = message.key ? message.key.toString() : null;
          const value = message.value ? JSON.parse(message.value.toString()) : null;
          
          console.log(`Received Kafka message: topic=${topic}, key=${key}, value=`, value);

          // Handle different topics
          switch (topic) {
            case userEventsTopic:
              await userEventHandler(key, value);
              break;
            default:
              console.warn(`Unhandled topic: ${topic}`);
          }
        } catch (err) {
          console.error('Error processing Kafka message:', err);
        }
      },
    });

    console.log(`Kafka consumer started and subscribed to topic: ${userEventsTopic}`);
  } catch (error) {
    console.error('Failed to initialize Kafka consumer:', error);
    isConnected = false;
  }
}

/**
 * Disconnect from Kafka
 */
async function disconnectKafka() {
  if (consumer && isConnected) {
    try {
      await consumer.disconnect();
      console.log('Disconnected from Kafka');
      isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from Kafka:', error);
    }
  }
}

/**
 * Check if Kafka is connected
 */
function isKafkaConnected() {
  return isConnected;
}

module.exports = {
  initKafka,
  disconnectKafka,
  isKafkaConnected
};