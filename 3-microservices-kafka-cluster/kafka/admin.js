import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "kafka-service",
  brokers: ["localhost:9094", "localhost:9095", "localhost:9096"],
  retry: {
    initialRetryTime: 500,
    retries: 20,
  },
});

const admin = kafka.admin();
const requiredTopics = [
  { topic: "payment-successful", numPartitions: 3, replicationFactor: 3 },
  { topic: "order-successful", numPartitions: 3, replicationFactor: 3 },
  { topic: "email-successful", numPartitions: 3, replicationFactor: 3 },
  { topic: "analytics-successful", numPartitions: 3, replicationFactor: 3 },
];

const prepareTopics = async () => {
  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const missingTopics = requiredTopics.filter(
      ({ topic }) => !existingTopics.includes(topic)
    );

    if (!missingTopics.length) {
      console.log("Kafka topics already exist.");
      return;
    }

    await admin.createTopics({
      waitForLeaders: true,
      topics: missingTopics,
    });

    console.log(
      `Kafka topics created: ${missingTopics
        .map(({ topic }) => topic)
        .join(", ")}`
    );
  } finally {
    await admin.disconnect();
  }
};

const run = async () => {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prepareTopics();
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const waitTime = Math.min(attempt * 2_000, 10_000);
      console.log(
        `Kafka is still becoming ready (${attempt}/${maxAttempts}). Retrying in ${
          waitTime / 1000
        }s...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};

run().catch((error) => {
  console.error("Could not prepare Kafka topics:", error);
  process.exit(1);
});
