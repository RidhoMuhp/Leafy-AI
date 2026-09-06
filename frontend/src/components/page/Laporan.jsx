import { useState } from "react";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";

export default function Laporan() {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const data = [
    { jenis: "Surat Masuk", total: 120 },
    { jenis: "Surat Keluar", total: 95 },
    { jenis: "Arsip", total: 340 },
  ];

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">

      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1">

        <Navbar title="Laporan" setOpen={setOpen} />

        <div className="p-6">

          {/* Filter */}
          <div className="bg-white p-4 rounded-xl shadow mb-6">

            <h2 className="font-semibold mb-4">
              Filter Laporan
            </h2>

            <div className="flex flex-col md:flex-row gap-4">

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border p-1 rounded w-full"
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border p-1 rounded w-full"
              />

              <button className="bg-blue-600 text-white px-4 py-2 rounded">
                Tampilkan
              </button>

            </div>

          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {data.map((item) => (
              <div
                key={item.jenis}
                className="bg-white p-5 rounded-xl shadow"
              >
                <h3 className="text-gray-500">
                  {item.jenis}
                </h3>

                <p className="text-3xl font-bold mt-2">
                  {item.total}
                </p>

                <p className="text-sm text-gray-400 mt-1">
                  Total data sistem
                </p>
              </div>
            ))}

          </div>

          {/* Chart Simple */}
          <div className="bg-white p-5 rounded-xl shadow mt-3">

            <h2 className="font-semibold mb-4">
              Ringkasan Laporan
            </h2>

            <div className="space-y-3">

              {data.map((item) => (
                <div
                  key={item.jenis}
                  className="flex justify-between border-b pb-2"
                >
                  <span>{item.jenis}</span>
                  <span className="font-semibold">
                    {item.total}
                  </span>
                </div>
              ))}

            </div>

          </div>

          {/* Export */}
          <div className="mt-3 flex gap-3">

            <button className="bg-green-600 text-white px-4 py-2 rounded">
              Export PDF
            </button>

            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Export Excel
            </button>

          </div>

        </div>

      </main>

    </div>
  );
}