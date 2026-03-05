
export default function HomePage() {
  const projects = [
    {
      title: "AI KTP Reader",
      description:
        "OCR-based Indonesian ID card reader using EasyOCR & FastAPI backend.",
      tech: ["Python", "FastAPI", "EasyOCR"],
      link: "#",
    },
    {
      title: "Freelance Service Platform",
      description:
        "Web marketplace for local freelance services with versioned workflow system.",
      tech: ["React", "Node.js", "MySQL"],
      link: "#",
    },
    {
      title: "RAG Chatbot Service",
      description:
        "Retrieval-Augmented Generation chatbot deployed on private server.",
      tech: ["LLM", "Vector DB", "Docker"],
      link: "#",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white">
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold tracking-wide">
          Muhpri<span className="text-indigo-500">Dev</span>
        </h1>
        <div className="space-x-6 hidden md:block">
          <a href="#projects" className="hover:text-indigo-400 transition">
            Projects
          </a>
          <a href="#about" className="hover:text-indigo-400 transition">
            About
          </a>
          <a href="#contact" className="hover:text-indigo-400 transition">
            Contact
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center px-6 py-24">
        <h2 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
          Building <span className="text-indigo-500">AI + Web</span> Solutions
        </h2>
        <p className="max-w-2xl text-gray-400 mb-8">
          Focused on AI-powered web applications, system design, and scalable
          backend architecture. Passionate about turning ideas into real-world
          products.
        </p>
        <div className="space-x-4">
          <a
            href="#projects"
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-semibold transition"
          >
            View Projects
          </a>
          <a
            href="#contact"
            className="border border-gray-700 hover:border-indigo-500 px-6 py-3 rounded-xl transition"
          >
            Contact Me
          </a>
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="px-8 py-20 bg-gray-900">
        <h3 className="text-3xl font-bold text-center mb-12">
          Playground 
        </h3>

        <div className="grid md:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <div
              key={index}
              className="bg-gray-800 p-6 rounded-2xl shadow-lg hover:scale-105 hover:shadow-indigo-500/20 transition duration-300"
            >
              <h4 className="text-xl font-semibold mb-3">
                {project.title}
              </h4>
              <p className="text-gray-400 mb-4">
                {project.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-4">
                {project.tech.map((t, i) => (
                  <span
                    key={i}
                    className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <a
                href={project.link}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                View Details →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-8 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-6">About Me</h3>
          <p className="text-gray-400 leading-relaxed">
            I specialize in AI-integrated web applications combining machine
            learning systems with modern frontend architecture. My focus is
            building scalable, production-ready systems that can evolve into
            real startups.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="px-8 py-16 bg-gray-900 text-center border-t border-gray-800"
      >
        <h3 className="text-2xl font-bold mb-4">Let's Build Something</h3>
        <p className="text-gray-400 mb-6">
          Open for collaboration, freelance, or AI system development.
        </p>
        <a
          href="mailto:your@email.com"
          className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-semibold transition"
        >
          Send Email
        </a>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-gray-600 text-sm border-t border-gray-800">
        © {new Date().getFullYear()} MuhpriDev. Built with React & Tailwind.
      </footer>
    </div>
  );
}