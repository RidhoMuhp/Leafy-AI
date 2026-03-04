// Hero section simple 
import React from "react";

export default function Hero1() {
    return(
        <section className="grid md:grid-cols-2 h-screen">
            <div className="flex flex-col justify-center px-12">
                <h1 className="text-5xl font-bold mb-6">Scale your Bussiness</h1>
                <p className="">Deliver high-performance digital experiences with ease.</p>
                <button>Start Free Trial</button>
            </div>
            <div className="hidden md:block bg-[url(/hero-images.jpg)] bg-cover bg-center"></div>
        </section>
    )
}