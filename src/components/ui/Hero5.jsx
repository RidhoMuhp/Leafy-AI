import React from "react";

export default function Hero({
  title = "Empowering Lives Through Health",
  subtitle = "Design + code = happy users. We help teams ship faster with delightful UI and robust UX.",
  ctaText = "Get started",
  ctaHref = "#",
  imageSrc = "/images/health.png",
  imageAlt = "Product mockup",
}) {
  return (
    <section className="relative bg-gray-300 overflow-hidden rounded-3xl mt-2">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-2 ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center py-12 lg:py-18 ">
          {/* LEFT: Text */}
          <div className="relative z-10 px-3 md:px-0 text-center md:text-left">
            <p className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-600 mb-4">
              New • Component
            </p>
            <h1 className="text-left pl-8 text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-gray-900 leading-tight">
              {title}
            </h1>
            <p className="text-left pl-8 mt-6 text-lg text-gray-600 max-w-2xl">{subtitle}</p>

            <div className="pl-8 mt-8 flex flex-wrap gap-4">
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-600 text-white"
              >
                {ctaText}
              </a>

              <a
                href="#learn"
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-medium bg-white border border-gray-200 text-gray-700 shadow-sm"
              >
                Learn more
              </a>
            </div>
          </div>

          {/* RIGHT: Image */}
          <div className="relative">
            <div className="w-full overflow-hidden pr-4">
              <img
                src={imageSrc}
                alt={imageAlt}
                loading="lazy"
                className="w-full h-70 sm:h-80 md:h-96 object-cover block"
              />
              <span className="absolute px-4 py-2 bg-white top-12 left-10 text-cyan-800 text-sm drop-shadow-lg rounded rounded-full">Selfcare</span>
              <span className="absolute px-4 py-2 bg-white top-80 left-90 text-cyan-800 text-sm drop-shadow-lg rounded rounded-full">Mindfullness</span>
              <span className="absolute px-4 py-2 bg-white top-50 left-10 text-black text-sm drop-shadow-lg rounded rounded-full">Lifestyle</span>
              <span className="absolute px-4 py-2 bg-white top-1 left-70 text-black text-sm drop-shadow-lg rounded rounded-full">Worklife balance</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
