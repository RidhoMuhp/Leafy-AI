// Hero section simple 
import React from "react";

export default function Hero() {
    return(
        <section className="h-screen flex flex-col items-center justify-center text-center px-6">
            <h1 className="text-5xl font-bold mb-4">Build With Confidence</h1>
            <p className="text-lg text-gray-600 max-w-xl">simple, Modern, and Scalable web app built With React and Tailwind</p>
            <div className="mt-6 flex gap-4">
                <button className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">Get Started</button>
                <button className="px-6 py-3 rounded-xl border border-gray-400 hover:bg-gray-100">Learn More</button>
            </div>
        </section>
    )
}