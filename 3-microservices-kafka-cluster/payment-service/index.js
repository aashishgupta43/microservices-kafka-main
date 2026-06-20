import express from "express";
import cors from "cors";
import { Kafka } from "kafkajs";
import { randomUUID } from "node:crypto";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(express.json());

const kafka = new Kafka({
  clientId: "payment-service",
  brokers: ["localhost:9094", "localhost:9095", "localhost:9096"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "checkout-status-service" });
const checkouts = new Map();

const completeStep = (checkoutId, step, result) => {
  const checkout = checkouts.get(checkoutId);
  if (!checkout) return;

  checkout.steps[step] = {
    status: "completed",
    completedAt: Date.now(),
    result,
  };

  if (step === "analytics") {
    checkout.status = "completed";
    checkout.completedAt = Date.now();
    checkout.duration = Number(
      ((checkout.completedAt - checkout.startedAt) / 1000).toFixed(2)
    );
  }
};

const connectToKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({
      topics: ["order-successful", "email-successful", "analytics-successful"],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const payload = JSON.parse(message.value.toString());
        const { checkoutId } = payload;

        if (topic === "order-successful") {
          completeStep(checkoutId, "order", {
            message: "Order created successfully",
            orderId: payload.orderId,
          });
        }

        if (topic === "email-successful") {
          completeStep(checkoutId, "email", {
            message: "Confirmation email sent",
            emailId: payload.emailId,
          });
        }

        if (topic === "analytics-successful") {
          completeStep(checkoutId, "analytics", {
            message: "Checkout analytics recorded",
            eventsProcessed: payload.eventsProcessed,
          });
        }
      },
    });

    console.log("Payment producer and checkout status consumer connected!");
  } catch (err) {
    console.log("Error connecting to Kafka", err);
  }
};

app.post("/payment-service", async (req, res) => {
  const { cart } = req.body;
  const userId = "123";
  const checkoutId = randomUUID();
  const startedAt = Date.now();
  const total = cart.reduce((sum, item) => sum + item.price, 0).toFixed(2);

  checkouts.set(checkoutId, {
    checkoutId,
    userId,
    status: "processing",
    startedAt,
    steps: {
      payment: { status: "processing" },
      order: { status: "waiting" },
      email: { status: "waiting" },
      analytics: { status: "waiting" },
    },
  });

  await producer.send({
    topic: "payment-successful",
    messages: [{ value: JSON.stringify({ checkoutId, userId, cart }) }],
  });

  completeStep(checkoutId, "payment", {
    message: "Payment processed successfully",
    amount: total,
    transactionId: `TXN-${checkoutId.slice(0, 8).toUpperCase()}`,
  });

  return res.status(202).json({ checkoutId });
});

app.get("/checkout-status/:checkoutId", (req, res) => {
  const checkout = checkouts.get(req.params.checkoutId);

  if (!checkout) {
    return res.status(404).json({ message: "Checkout not found" });
  }

  return res.json(checkout);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).send(err.message);
});

const port = Number(process.env.PORT) || 8001;

app.listen(port, () => {
  connectToKafka();
  console.log(`Payment service is running on port ${port}`);
});
