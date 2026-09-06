import {
  FiHome,
  FiInbox,
  FiSend,
  FiFolder,
  FiFileText,
  FiSettings,
  FiUser,
} from "react-icons/fi";

import { useNavigate, useLocation } from "react-router-dom";

export default function Sidebar({ open, setOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menus = [
    {
      text: "Dashboard",
      icon: <FiHome />,
      path: "/dashboard",
    },
    {
      text: "Surat Masuk",
      icon: <FiInbox />,
      path: "/surat-masuk",
    },
    {
      text: "Surat Keluar",
      icon: <FiSend />,
      path: "/surat-keluar",
    },
    {
      text: "Arsip Digital",
      icon: <FiFolder />,
      path: "/arsip",
    },
    {
      text: "Laporan",
      icon: <FiFileText />,
      path: "/laporan",
    },
    {
      text: "Pengaturan",
      icon: <FiSettings />,
      path: "/pengaturan",
    },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 xl:hidden z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed xl:static z-50 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white flex flex-col h-screen transition-transform duration-300
        ${
          open
            ? "translate-x-0"
            : "-translate-x-full xl:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-blue-700">
          <h1 className="font-bold text-lg">
            ARSIP DIGITAL
          </h1>
        </div>

        <nav className="p-4 space-y-2">
          {menus.map((menu) => (
            <button
              key={menu.path}
              onClick={() => {
                navigate(menu.path);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition
              ${
                location.pathname === menu.path
                  ? "bg-blue-600"
                  : "hover:bg-blue-700"
              }`}
            >
              {menu.icon}
              <span>{menu.text}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <FiUser />
            </div>

            <div>
              <p className="font-medium">
                Admin
              </p>

              <p className="text-xs text-blue-200">
                Administrator
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}