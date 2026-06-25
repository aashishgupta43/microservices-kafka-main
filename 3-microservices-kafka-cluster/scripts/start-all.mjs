import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicesDir = rootDir;
const kafkaComposeFile = path.join(rootDir, "kafka", "docker-compose.yml");
const children = [];
let shuttingDown = false;

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

const waitForPort = (port, timeoutMs = 120_000) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const connect = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });

      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });

      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Kafka port ${port} was not ready in time`));
          return;
        }

        setTimeout(connect, 1_000);
      });
    };

    connect();
  });

const startService = (name, directory, args) => {
  console.log(`Starting ${name}...`);

  const child = spawn(args[0], args.slice(1), {
    cwd: path.join(servicesDir, directory),
    stdio: "inherit",
  });

  children.push(child);

  child.once("error", (error) => {
    console.error(`${name} failed to start:`, error.message);
    shutdown(1);
  });

  child.once("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${name} stopped with code ${code ?? "unknown"}`);
      shutdown(code || 1);
    }
  });
};

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\nStopping application services...");
  for (const child of children) {
    if (!child.killed) child.kill();
  }

  try {
    await run("docker", ["compose", "-f", kafkaComposeFile, "down"]);
  } catch (error) {
    console.error("Kafka cluster could not be stopped:", error.message);
  }

  process.exit(exitCode);
};

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

try {
  console.log("Starting the 3-broker Kafka cluster...");
  await run("docker", ["compose", "-f", kafkaComposeFile, "up", "-d"]);

  console.log("Waiting for Kafka brokers...");
  await Promise.all([9094, 9095, 9096].map((port) => waitForPort(port)));
  await new Promise((resolve) => setTimeout(resolve, 4_000));

  console.log("Creating required Kafka topics...");
  await run("node", ["admin.js"], {
    cwd: path.join(rootDir, "kafka"),
  });

  startService("order-service", "order-service", ["node", "index.js"]);
  startService("payment-service", "payment-service", ["node", "index.js"]);
  startService("email-service", "email-service", ["node", "index.js"]);
  startService("analytic-service", "analytic-service", ["node", "index.js"]);
  if (process.platform === "win32") {
    startService("client", "client", [
      process.env.ComSpec || "cmd.exe",
      "/d",
      "/s",
      "/c",
      "npm run dev",
    ]);
  } else {
    startService("client", "client", ["npm", "run", "dev"]);
  }

  console.log("\nAll services are running.");
  console.log("Client: http://localhost:3000");
  console.log("Payment API: http://localhost:8001");
  console.log("Kafka UI: http://localhost:8084");
  console.log("Press Ctrl+C to stop everything.");
} catch (error) {
  console.error("\nCould not start all services:", error.message);
  await shutdown(1);
}
