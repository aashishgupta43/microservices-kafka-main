# Event-Driven Microservices with Apache Kafka

A practical e-commerce checkout demo that shows how an application can evolve
from a monolith into an event-driven microservices architecture powered by an
Apache Kafka cluster.

The final implementation contains a Next.js client, four independent Node.js
services, three Kafka brokers, and Kafka UI for monitoring messages.

## Project Evolution

This repository contains three versions of the same application:

| Directory | Architecture |
| --- | --- |
| `1-without-microservices` | Traditional frontend and backend application |
| `2-microservices-single-kafka-server` | Microservices using one Kafka broker |
| `3-microservices-kafka-cluster` | Microservices using a three-broker Kafka cluster |

The third version is the complete and recommended implementation.

## Architecture

```text
                         payment-successful
Next.js Client --HTTP--> Payment Service --------------+
                                                      |
                                                      v
                                              Order Service
                                                      |
                                               order-successful
                                                      |
                                                      v
                                              Email Service
                                                      |
                                               email-successful
                                                      |
                                                      v
                                              Analytics Service

All events flow through a three-broker Apache Kafka cluster.
Analytics Service listens to every event in the checkout pipeline.
```

## Services

| Service | Responsibility | Interface |
| --- | --- | --- |
| Client | Shopping cart and checkout UI | `http://localhost:3000` |
| Payment Service | Accepts checkout requests and publishes payment events | `http://localhost:8001` |
| Order Service | Creates an order after successful payment | Kafka consumer/producer |
| Email Service | Sends a confirmation after order creation | Kafka consumer/producer |
| Analytics Service | Tracks payment, order, and email events | Kafka consumer |
| Kafka UI | Inspect brokers, topics, messages, and consumer groups | `http://localhost:8084` |

## Kafka Topics

| Topic | Producer | Consumers |
| --- | --- | --- |
| `payment-successful` | Payment Service | Order Service, Analytics Service |
| `order-successful` | Order Service | Email Service, Analytics Service |
| `email-successful` | Email Service | Analytics Service |

## Tech Stack

- Node.js and Express
- Next.js 15 and React 19
- Apache Kafka with KRaft
- KafkaJS
- Docker and Docker Compose
- TanStack Query and Axios
- Tailwind CSS

## Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) 18 or newer
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- npm

Make sure Docker Desktop is running.

## Quick Start

Open a terminal from the repository root:

```bash
cd 3-microservices-kafka-cluster
```

Install dependencies the first time:

```bash
npm install
npm install --prefix client
npm install --prefix payment-service
npm install --prefix order-service
npm install --prefix email-service
npm install --prefix analytic-service
```

Start the complete system with one command:

```bash
npm start
```

This command:

1. Starts three Kafka brokers and Kafka UI with Docker Compose.
2. Waits until all Kafka brokers are ready.
3. Starts Payment, Order, Email, and Analytics services.
4. Starts the Next.js client.

Open the application at [http://localhost:3000](http://localhost:3000).

## Testing the Event Flow

1. Open the client in your browser.
2. Click **CHECKOUT**.
3. Payment Service publishes a `payment-successful` event.
4. Order Service consumes it and publishes `order-successful`.
5. Email Service consumes the order event and publishes `email-successful`.
6. Analytics Service logs all three events.
7. Open Kafka UI to inspect topics and messages.

Example terminal output:

```text
Payment service is running on port 8001
Order consumer: Order created for user id: 123
Email consumer: Email sent to user id 123
Analytic consumer: User 123 paid 149.98
```

## Ports

| Port | Used by |
| ---: | --- |
| `3000` | Next.js client |
| `8001` | Payment API |
| `8084` | Kafka UI |
| `9094` | Kafka broker 1 |
| `9095` | Kafka broker 2 |
| `9096` | Kafka broker 3 |

The Kafka broker ports use the Kafka protocol and should not be opened as web
pages in a browser.

## Stopping the Application

Press `Ctrl+C` in the terminal where `npm start` is running. The launcher stops
the application services and removes the Kafka containers.

To stop only the Kafka cluster manually:

```bash
npm run kafka:stop
```

## Project Structure

```text
3-microservices-kafka-cluster/
├── analytic-service/
│   └── index.js
├── client/
│   ├── public/
│   └── src/
├── email-service/
│   └── index.js
├── kafka/
│   ├── admin.js
│   └── docker-compose.yml
├── order-service/
│   └── index.js
├── payment-service/
│   └── index.js
├── scripts/
│   └── start-all.mjs
└── package.json
```

## Troubleshooting

### Docker is not running

Start Docker Desktop and run `npm start` again.

### A port is already in use

On Windows, find the process using a port:

```powershell
netstat -ano | Select-String ":8001"
```

Then inspect the PID:

```powershell
Get-Process -Id <PID>
```

### CORS error from the browser

Confirm that the client is running on port `3000` and Payment Service is
running on port `8001`. Restart the complete system after changing a port.

### Kafka services cannot connect

Check that all containers are running:

```bash
docker compose -f kafka/docker-compose.yml ps
```

Kafka UI at [http://localhost:8084](http://localhost:8084) can also be used to
verify brokers, topics, and consumer groups.

## Current Demo Limitations

This is a learning project. Payment processing, database persistence, user
authentication, and email delivery are currently simulated. These parts are
clearly marked with `TODO` comments and can be replaced with real integrations.

## License

This project is available for learning and experimentation.
