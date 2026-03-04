import React from "react";
import { motion } from "framer-motion";

/**
 * AdvancedHero_CurveBG.jsx
 * A responsive hero component with:
 * - Full-bleed background image
 * - Dark gradient overlay for legibility
 * - Curved SVG background at the bottom
 * - Centered content with headline, subhead, CTAs
 * - Small feature pills and subtle framer-motion entry
 *
 * Usage:
 * <AdvancedHero
 *   imageUrl="/images/hero.jpg"
 *   eyebrow="Build faster"
 *   title={<><span className="text-indigo-400">Design</span> and ship beautiful apps</>}
 *   subtitle="Modern templates, accessible components, and delightful interactions."
 * />
 *
 * Requirements: Tailwind CSS and framer-motion installed.
 */

export default function AdvancedHero({
  imageUrl = "https://images.unsplash.com/photo-1506765515384-028b60a970df?auto=format&fit=crop&w=2000&q=80",
  eyebrow = "Launch faster",
  title = (
    <>
      Build <span className="text-indigo-300">beautiful</span> products, faster
    </>
  ),
  subtitle = "Design systems, components, and workflows that scale across teams.",
  primaryCta = { label: "Get started", href: "#" },
  secondaryCta = { label: "View docs", href: "#" },
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center filter will-change-transform"
        style={{ backgroundImage: `url(${imageUrl})` }}
        aria-hidden
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="pt-24 pb-32 lg:pt-32 lg:pb-40">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center lg:text-left"
          >
            <p className="inline-flex items-center gap-3 text-sm font-medium text-indigo-200 bg-indigo-900/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              {eyebrow}
            </p>

            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
              {title}
            </h1>

            <p className="mt-4 max-w-2xl mx-auto lg:mx-0 text-lg text-indigo-100/90">
              {subtitle}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:justify-center lg:justify-start gap-3">
              <a
                href={primaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold bg-indigo-500/95 hover:bg-indigo-400 shadow-2xl text-white backdrop-blur"
              >
                {primaryCta.label}
              </a>

              <a
                href={secondaryCta.href}
                className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                {secondaryCta.label}
              </a>
            </div>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-2">
              <FeaturePill icon="🚀" text="Production-ready" />
              <FeaturePill icon="⚡" text="Fast performance" />
              <FeaturePill icon="🔒" text="Secure by default" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Curved SVG at bottom */}
      <div className="absolute left-0 right-0 bottom-0 pointer-events-none">
        <svg
          viewBox="0 0 1440 120"
          className="w-full h-auto"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop offset="0%" stopColor="rgba(99,102,241,0.12)" />
              <stop offset="100%" stopColor="rgba(124,58,237,0.06)" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 C240,120 480,0 720,40 C960,80 1200,20 1440,60 L1440,120 L0,120 Z"
            fill="url(#g1)"
          />
          <path
            d="M0,60 C240,140 480,20 720,60 C960,100 1200,40 1440,80 L1440,120 L0,120 Z"
            fill="rgba(0,0,0,0.06)"
          />
        </svg>
      </div>

      {/* Decorative floating card */}
      <FloatingCard />
    </section>
  );
}

function FeaturePill({ icon, text }) {
  return (
    <div className="inline-flex items-center gap-2 bg-white/6 px-3 py-1 rounded-full text-sm text-indigo-100/90">
      <span className="text-sm">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function FloatingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="absolute right-6 bottom-28 hidden md:flex w-72 bg-white/6 backdrop-blur-md border border-white/6 rounded-2xl p-4 shadow-2xl"
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
        AI
      </div>
      <div className="ml-3">
        <p className="text-sm font-semibold text-white">Smart templates</p>
        <p className="text-xs text-indigo-100/80 mt-1">Generate UI scaffolding with presets.</p>
      </div>
    </motion.div>
  );
}
