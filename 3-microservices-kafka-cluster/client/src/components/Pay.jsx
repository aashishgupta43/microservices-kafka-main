"use client";

import axios from "axios";
import {
  BarChart3,
  Check,
  CreditCard,
  Loader2,
  Mail,
  PackageCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

const initialSteps = {
  payment: { status: "waiting" },
  order: { status: "waiting" },
  email: { status: "waiting" },
  analytics: { status: "waiting" },
};

const serviceMeta = [
  {
    key: "payment",
    title: "Payment Service",
    subtitle: "Secure payment processing",
    icon: CreditCard,
  },
  {
    key: "order",
    title: "Order Service",
    subtitle: "Creating your order",
    icon: PackageCheck,
  },
  {
    key: "email",
    title: "Email Service",
    subtitle: "Sending confirmation",
    icon: Mail,
  },
  {
    key: "analytics",
    title: "Analytics Service",
    subtitle: "Recording checkout events",
    icon: BarChart3,
  },
];

const Pay = ({ cart }) => {
  const total = cart.reduce((acc, item) => acc + item.price, 0).toFixed(2);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!checkout?.checkoutId || checkout.status === "completed") return;

    const pollStatus = async () => {
      try {
        const { data } = await axios.get(
          `http://localhost:8001/checkout-status/${checkout.checkoutId}`
        );
        setCheckout(data);
      } catch {
        setError("Unable to read the latest service status.");
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 500);
    return () => clearInterval(interval);
  }, [checkout?.checkoutId, checkout?.status]);

  const handleCheckout = async () => {
    setIsOpen(true);
    setIsSubmitting(true);
    setError("");
    setCheckout({
      status: "processing",
      steps: {
        ...initialSteps,
        payment: { status: "processing" },
      },
    });

    try {
      const { data } = await axios.post(
        "http://localhost:8001/payment-service",
        {
          cart,
        }
      );

      setCheckout((current) => ({ ...current, checkoutId: data.checkoutId }));
    } catch {
      setError("Checkout could not be started. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closePopup = () => {
    if (!isSubmitting) setIsOpen(false);
  };

  const getResult = (key, result) => {
    if (!result) return "";
    if (key === "payment") return `Transaction ${result.transactionId}`;
    if (key === "order") return `Order #${result.orderId}`;
    if (key === "email") return `Email ref ${result.emailId}`;
    return `${result.eventsProcessed} events processed`;
  };

  return (
    <>
      <div className="bg-red-50 flex flex-col items-center justify-center gap-4 py-8 rounded-xl">
        <div className="flex flex-col gap-12">
          <div>
            <div className="flex items-center gap-8">
              <h1 className="font-thin tracking-wider">CART TOTAL</h1>
              <h2 className="text-xl font-bold tracking-widest">${total}</h2>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Shipping & taxes calculated at checkout
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              id="terms"
              className="w-4 h-4"
              defaultChecked
            />
            <label htmlFor="terms">
              I agree to the{" "}
              <span className="text-red-300">Terms and Conditions</span>
            </label>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span className="font-semibold text-sm">Saved Card:</span>
            <Image src="/visa.png" alt="card" width={30} height={20} />
            <span className="font-semibold text-xs">**** 3567</span>
            <span className="text-xs text-red-300">(change)</span>
          </div>
          <button
            disabled={isSubmitting}
            className="bg-black px-5 py-3 text-white rounded-full flex items-center gap-4 w-max cursor-pointer hover:bg-gray-700 transition-all duration-300 disabled:cursor-not-allowed"
            onClick={handleCheckout}
          >
            <span className="tracking-wider text-sm">CHECKOUT</span>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm checkout-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Checkout service progress"
        >
          <div className="checkout-modal relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-7 py-6 text-white">
              <button
                onClick={closePopup}
                className="absolute right-5 top-5 rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                aria-label="Close checkout progress"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Live checkout
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {checkout?.status === "completed"
                  ? "Everything is complete!"
                  : "Services are working..."}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Follow your order across the Kafka event pipeline.
              </p>
            </div>

            <div className="space-y-3 p-6">
              {serviceMeta.map(({ key, title, subtitle, icon: Icon }, index) => {
                const step = checkout?.steps?.[key] || initialSteps[key];
                const completed = step.status === "completed";
                const previousKey = serviceMeta[index - 1]?.key;
                const previousCompleted =
                  index === 0 ||
                  checkout?.steps?.[previousKey]?.status === "completed";
                const processing =
                  step.status === "processing" ||
                  (step.status === "waiting" &&
                    previousCompleted &&
                    checkout?.status !== "completed");

                return (
                  <div
                    key={key}
                    className={`service-step flex items-center gap-4 rounded-2xl border p-4 ${
                      completed
                        ? "border-emerald-200 bg-emerald-50"
                        : processing
                          ? "border-cyan-200 bg-cyan-50"
                          : "border-slate-100 bg-slate-50"
                    }`}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        completed
                          ? "bg-emerald-500 text-white"
                          : processing
                            ? "bg-cyan-500 text-white"
                            : "bg-slate-200 text-slate-400"
                      }`}
                    >
                      {completed ? (
                        <Check className="h-5 w-5 checkout-check" />
                      ) : processing ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-slate-900">{title}</h3>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${
                            completed
                              ? "text-emerald-600"
                              : processing
                                ? "text-cyan-600"
                                : "text-slate-400"
                          }`}
                        >
                          {completed
                            ? "Success"
                            : processing
                              ? "Processing"
                              : "Waiting"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {completed ? step.result?.message : subtitle}
                      </p>
                      {completed && (
                        <p className="mt-1 truncate text-xs font-medium text-emerald-700">
                          {getResult(key, step.result)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              {checkout?.status === "completed" && (
                <div className="checkout-success mt-5 flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-white">
                  <div>
                    <p className="text-sm text-slate-300">Total processing time</p>
                    <p className="text-2xl font-black text-cyan-300">
                      {checkout.duration} seconds
                    </p>
                  </div>
                  <button
                    onClick={closePopup}
                    className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-100"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Pay;
