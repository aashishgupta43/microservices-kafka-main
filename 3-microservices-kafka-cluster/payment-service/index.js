import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto, { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Kafka } from "kafkajs";
import Razorpay from "razorpay";

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(serviceDir, ".env"),
  override: true,
});

console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET);

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
  retry: {
    initialRetryTime: 500,
    retries: 20,
  },
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "checkout-status-service" });
const checkouts = new Map();
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

const productCatalog = new Map([
  [1, { id: 1, name: "Nike Air Max", price: 129.9 }],
  [2, { id: 2, name: "Adidas Superstar Cap", price: 29.9 }],
  [3, { id: 3, name: "Puma Yellow T-Shirt", price: 49.9 }],
]);

const getVerifiedCart = (cart = []) =>
  cart.map(({ id }) => {
    const product = productCatalog.get(Number(id));
    if (!product) throw new Error(`Unknown product id: ${id}`);
    return product;
  });

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

const failCheckout = (checkoutId, message, result = {}) => {
  const checkout = checkouts.get(checkoutId);
  if (!checkout || checkout.status === "completed") return checkout;

  const failedAt = Date.now();
  checkout.status = "failed";
  checkout.completedAt = failedAt;
  checkout.duration = Number(
    ((failedAt - checkout.startedAt) / 1000).toFixed(2)
  );
  checkout.steps.payment = {
    status: "failed",
    completedAt: failedAt,
    result: { message, ...result },
  };

  for (const step of ["order", "email", "analytics"]) {
    checkout.steps[step] = {
      status: "skipped",
      result: { message: "Skipped because payment was not successful" },
    };
  }

  return checkout;
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

app.post("/payment-service/create-order", async (req, res, next) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        message:
          "Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      });
    }

    const cart = getVerifiedCart(req.body.cart);
    if (!cart.length) {
      return res.status(400).json({ message: "Select at least one product" });
    }

    const userId = "123";
    const checkoutId = randomUUID();
    const startedAt = Date.now();
    const total = Number(
      cart.reduce((sum, item) => sum + item.price, 0).toFixed(2)
    );
    const amount = Math.round(total * 100);
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `checkout_${checkoutId.slice(0, 20)}`,
      notes: { checkoutId, userId },
    });

    checkouts.set(checkoutId, {
      checkoutId,
      userId,
      cart,
      total,
      currency: order.currency,
      razorpayOrderId: order.id,
      status: "awaiting_payment",
      startedAt,
      steps: {
        payment: { status: "processing" },
        order: { status: "waiting" },
        email: { status: "waiting" },
        analytics: { status: "waiting" },
      },
    });

    return res.status(201).json({
      checkoutId,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/payment-service/verify", async (req, res, next) => {
  try {
    const {
      checkoutId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;
    const checkout = checkouts.get(checkoutId);

    if (!checkout || checkout.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Invalid checkout or order" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      failCheckout(checkoutId, "Razorpay signature verification failed", {
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({ checkoutId, verified: false });
    }

    checkout.status = "processing";
    completeStep(checkoutId, "payment", {
      message: "Razorpay payment verified successfully",
      amount: checkout.total.toFixed(2),
      transactionId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });

    await producer.send({
      topic: "payment-successful",
      messages: [
        {
          value: JSON.stringify({
            checkoutId,
            userId: checkout.userId,
            cart: checkout.cart,
            total: checkout.total,
            razorpayPaymentId: razorpay_payment_id,
          }),
        },
      ],
    });

    return res.json({ checkoutId, verified: true });
  } catch (error) {
    next(error);
  }
});

app.post("/payment-service/failed", (req, res) => {
  const { checkoutId, reason, paymentId, errorCode } = req.body;
  const checkout = failCheckout(
    checkoutId,
    reason || "Razorpay payment was cancelled or failed",
    { paymentId, errorCode }
  );

  if (!checkout) {
    return res.status(404).json({ message: "Checkout not found" });
  }

  return res.json({ checkoutId, status: checkout.status });
});

app.get("/checkout-status/:checkoutId", (req, res) => {
  const checkout = checkouts.get(req.params.checkoutId);

  if (!checkout) {
    return res.status(404).json({ message: "Checkout not found" });
  }

  return res.json(checkout);
});

app.use((err, req, res, next) => {
  console.error(err);
  const razorpayStatus = err.statusCode || err.status;
  const isAuthenticationError =
    razorpayStatus === 401 ||
    err.error?.description?.toLowerCase().includes("authentication failed");

  res.status(razorpayStatus || 500).json({
    message: isAuthenticationError
      ? "Razorpay authentication failed. Generate a fresh Key ID and Key Secret pair, save both in payment-service/.env, and restart the application."
      : err.error?.description || err.message || "Payment service error",
  });
});

const port = Number(process.env.PORT) || 8001;

app.listen(port, () => {
  connectToKafka();
  console.log(`Payment service is running on port ${port}`);
});
