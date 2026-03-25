import { 
  FaReact, 
  FaNodeJs, 
  FaPython, 
  FaDocker, 
  FaDatabase 
} from "react-icons/fa";

import { 
  SiFastapi, 
  SiMysql, 
  SiTailwindcss 
} from "react-icons/si";

export default function TechStack() {

  const stack = [
    { icon: <FaReact size={40} />, name: "React" },
    { icon: <SiTailwindcss size={40} />, name: "Tailwind" },
    { icon: <FaNodeJs size={40} />, name: "Node.js" },
    { icon: <FaPython size={40} />, name: "Python" },
    { icon: <SiFastapi size={40} />, name: "FastAPI" },
    { icon: <SiMysql size={40} />, name: "MySQL" },
    { icon: <FaDatabase size={40} />, name: "Vector DB" },
    { icon: <FaDocker size={40} />, name: "Docker" },
  ];

  return (
    <section className="py-20 bg-gray-950 text-white">
      <h3 className="text-3xl font-bold text-center mb-12">
        Tech Stack
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-10 max-w-5xl mx-auto">
        {stack.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 p-6 bg-gray-900 rounded-xl hover:bg-gray-800 transition"
          >
            <div className="text-indigo-400">{item.icon}</div>
            <p className="text-sm text-gray-400">{item.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
} 