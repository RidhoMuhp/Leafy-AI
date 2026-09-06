import { useState } from "react";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";

export default function Pengaturan() {
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("Admin");
  const [email, setEmail] = useState("admin@arsip.com");
  const [password, setPassword] = useState("");

  const handleSave = (e) => {
    e.preventDefault();

    alert("Pengaturan berhasil disimpan (dummy)");
  };

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">

      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1">

        <Navbar title="Pengaturan" setOpen={setOpen} />

        <div className="p-6">

          {/* Profile Card */}
          <div className="bg-white p-6 rounded-xl shadow max-w-2xl">

            <h2 className="text-xl font-bold mb-4">
              Profil Admin
            </h2>

            <form onSubmit={handleSave} className="space-y-4">

              {/* Nama */}
              <div>
                <label className="text-sm text-gray-600">
                  Nama
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border p-2 rounded mt-1"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-gray-600">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border p-2 rounded mt-1"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-sm text-gray-600">
                  Password Baru
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border p-2 rounded mt-1"
                />
              </div>

              {/* Button */}
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Simpan Perubahan
              </button>

            </form>

          </div>

          {/* Info Sistem */}
          <div className="bg-white p-6 rounded-xl shadow mt-6 max-w-2xl">

            <h2 className="text-xl font-bold mb-4">
              Informasi Sistem
            </h2>

            <ul className="space-y-2 text-gray-600">
              <li>Versi: 1.0.0</li>
              <li>Status: Development</li>
              <li>Backend: Express.js</li>
              <li>Frontend: React + Tailwind</li>
            </ul>

          </div>

        </div>

      </main>

    </div>
  );
}