import React from "react";

export default function Hero2(){
    return(
        <section className="h-screen flex flex-col justify-center items-center text-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pin-500 text-white">
            <h1 className="text-6xl font-bold">Next-Gen Solutions</h1>
            <p className="mt-4 max-w-2xl"> Build, Launch, and scale your product faster with our modern stack</p>
            <button className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"> Get Started</button>
        </section>
    )
}