"use client";

import { Minus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import Pay from "@/components/Pay";

const products = [
  {
    id: 1,
    name: "Nike Air Max",
    price: 129.9,
    image: "/product1.png",
    description:
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos. Lorem ipsum dolor sit amet consectetur adipisicing elit.",
  },
  {
    id: 2,
    name: "Adidas Superstar Cap",
    price: 29.9,
    image: "/product2.png",
    description:
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos. Lorem ipsum dolor sit amet consectetur adipisicing elit.",
  },
  {
    id: 3,
    name: "Puma Yellow T-Shirt",
    price: 49.9,
    image: "/product3.png",
    description:
      "Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam, quos. Lorem ipsum dolor sit amet consectetur adipisicing elit.",
  },
];

const Page = () => {
  const [selectedIds, setSelectedIds] = useState([]);
  const cart = products.filter((product) => selectedIds.includes(product.id));

  const toggleProduct = (productId) => {
    setSelectedIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  };

  return (
    <div className="mb-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Build your cart
          </p>
          <h1 className="mt-2 text-3xl font-black">Choose your products</h1>
          <p className="mt-2 text-sm text-gray-500">
            Select a card or checkbox to add that product to checkout.
          </p>
        </div>
        <div className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white">
          {cart.length} selected
        </div>
      </div>
      <div className="flex flex-col lg:flex-row justify-between gap-16 mt-16">
        <div className="flex flex-col gap-16 w-full lg:w-2/3">
          {products.map((item) => {
            const selected = selectedIds.includes(item.id);

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => toggleProduct(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleProduct(item.id);
                  }
                }}
                className={`group relative flex cursor-pointer gap-4 rounded-2xl border-2 p-4 transition-all duration-300 ${
                  selected
                    ? "border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100"
                    : "border-transparent bg-white hover:border-gray-200 hover:shadow-lg"
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={`${selected ? "Remove" : "Add"} ${item.name} ${
                    selected ? "from" : "to"
                  } cart`}
                  className={`absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleProduct(item.id);
                  }}
                >
                  {selected && <span className="text-lg leading-none">✓</span>}
                </button>
              <Image
                src={item.image}
                alt={item.name}
                width={300}
                height={200}
                  className="rounded-xl object-cover"
                quality={100}
              />
                <div className="flex flex-1 flex-col gap-2 pr-10">
                <h3 className="text-lg font-bold">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">
                    ₹{item.price.toFixed(2)}
                  </h2>
                    <div
                      className={`flex items-center gap-1 rounded-md p-1 ${
                        selected
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-red-100 text-red-300"
                      }`}
                    >
                    <Minus className="w-2 h-2 text-red-300" />
                      <span className="text-[10px]">
                        {selected ? "Selected" : "Select"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="w-full lg:w-1/3 lg:sticky lg:top-6 lg:self-start">
          <Pay cart={cart} />
        </div>
      </div>
    </div>
  );
};

export default Page;
