import { useState } from "react";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";

export default function Arsip() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const data = [
    {
      id: 1,
      nama: "Surat Masuk - Dinas Pendidikan",
      tipe: "Masuk",
      file: "surat1.pdf",
      tanggal: "2026-06-10",
    },
    {
      id: 2,
      nama: "Surat Keluar - Dinas Kesehatan",
      tipe: "Keluar",
      file: "surat2.pdf",
      tanggal: "2026-06-09",
    },
  ];

  const filtered = data.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.nama.toLowerCase().includes(q) ||
      item.tipe.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">

      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1">

        <Navbar title="Arsip Digital" setOpen={setOpen} />

        <div className="p-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold">
              Arsip Digital
            </h1>

            <input
              type="text"
              placeholder="Cari arsip..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border p-2 rounded w-full md:w-80"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">

            <table className="w-full">
              <thead>
                <tr className="bg-slate-200">
                  <th className="p-3 text-left">No</th>
                  <th className="p-3 text-left">Nama Arsip</th>
                  <th className="p-3 text-left">Tipe</th>
                  <th className="p-3 text-left">Tanggal</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-6 text-gray-500">
                      Tidak ada data arsip
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">

                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">{item.nama}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 text-sm rounded ${
                            item.tipe === "Masuk"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {item.tipe}
                        </span>
                      </td>
                      <td className="p-3">{item.tanggal}</td>

                      <td className="p-3 text-center space-x-2">

                        <button className="bg-blue-500 text-white px-3 py-1 rounded">
                          View
                        </button>

                        <button className="bg-green-500 text-white px-3 py-1 rounded">
                          Download
                        </button>

                        <button className="bg-red-500 text-white px-3 py-1 rounded">
                          Delete
                        </button>

                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>

          </div>

        </div>

      </main>

    </div>
  );
}