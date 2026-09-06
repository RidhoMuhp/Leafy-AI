import {
  FiBell,
  FiMenu,
} from "react-icons/fi";

import { useNavigate } from "react-router-dom";

export default function Navbar({
  title,
  setOpen,
}) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">

      <div className="flex items-center gap-4">
        <button
          className="xl:hidden"
          onClick={() => setOpen && setOpen((prev) => !prev)}
        >
          <FiMenu size={22} />
        </button>

        <h1 className="font-semibold text-lg">
          {title}
        </h1>
      </div>

      <div className="flex items-center md:gap-5">

        <FiBell size={20} />

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-slate-300"></div>
          <span className="hidden md:block">Admin</span>
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>

      </div>
    </header>
  );
}