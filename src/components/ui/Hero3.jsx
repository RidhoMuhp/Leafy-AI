import React from "react";
import { motion } from "framer-motion";

export default function Hero3({
  image = "/images/overlay.jpg.png",
  title = "Build beautiful experiences",
  subtitle = "Create fast, accessible, and delightful interfaces with React + Tailwind.",
  ctaText = "Get started",
  ctaHref = "#",
}) {
  return (
    <header
      className="relative w-full overflow-hidden"
      aria-label="Hero section"
      style={{ minHeight: '66vh' }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transform-gpu will-change-transform"
        style={{
          backgroundImage: `url(${image})`,
          filter: 'saturate(1.05) contrast(1.02) brightness(0.85)'
        }}
        aria-hidden="true"
      />

      {/* Gradient overlay + noise */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/55 via-transparent to-black/25" />
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 800 600"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.06" />
            </linearGradient>
            <filter id="grain">
              <feTurbulence baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend mode="overlay" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>
      </div>

      {/* Decorative clipped shape */}
      <div className="absolute -bottom-6 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-24" preserveAspectRatio="none">
          <path
            d="M0,32 C180,96 360,0 540,32 C720,64 900,96 1080,48 C1260,0 1440,32 1440,32 L1440 120 L0 120 Z"
            fill="rgba(255,255,255,0.05)"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-28 lg:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-white"
          >
            <p className="inline-block px-3 py-1 rounded-full bg-white/10 text-sm tracking-wide mb-4 text-black">
              New — UI Toolkit
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-black">
              {title}
            </h1>
            <p className="mt-4 text-base sm:text-lg max-w-prose text-black">
              {subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-black">
              <a
                href={ctaHref}
                className="inline-flex items-center gap-3 rounded-2xl bg-white text-slate-900 font-semibold px-5 py-3 shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-white/30 transition"
              >
                {ctaText}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>

              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 text-black px-4 py-3 hover:bg-white/5 transition"
              >
                Learn more
              </a>
            </div>

            <div className="mt-6 text-sm text-black">
              Trusted by companies and creators worldwide — lightweight, accessible, and fast.
            </div>
          </motion.div>

          {/* Right column: feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 shadow-lg">
              <h3 className="text-black font-semibold">Performance-first</h3>
              <p className="mt-2 text-sm text-black">Pre-built patterns that ship small and load fast.</p>
            </div>

            <div className="bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 shadow-lg">
              <h3 className="text-black font-semibold">Accessible by default</h3>
              <p className="mt-2 text-sm text-black">Keyboard friendly and screen-reader ready components.</p>
            </div>

            <div className="bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 shadow-lg">
              <h3 className="text-black font-semibold">Design tokens</h3>
              <p className="mt-2 text-sm text-black">Easily theme colors, spacing, and typography centrally.</p>
            </div>
          </motion.div>
        </div>

        {/* small attribution or badges */}
        <div className="mt-8 flex items-center gap-4 text-sm text-black">
          <span>• Based on Tailwind & React</span>
          <span>• Lightweight</span>
          <span>• Responsive</span>
        </div>
      </div>

      {/* Accessibility: skip link to main content */}
      <a href="#main" className="sr-only">
        Skip to main content
      </a>
    </header>
  );
}
