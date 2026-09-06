import { useEffect } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";
import {
  FiMenu,
  FiHome,
  FiInbox,
  FiSend,
  FiFolder,
  FiFileText,
  FiSettings,
  FiBell,
  FiUser,
} from "react-icons/fi";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const chartData = [
  { month: "Des", masuk: 25, keluar: 15 },
  { month: "Jan", masuk: 32, keluar: 13 },
  { month: "Feb", masuk: 32, keluar: 15 },
  { month: "Mar", masuk: 42, keluar: 24 },
  { month: "Apr", masuk: 28, keluar: 16 },
  { month: "Mei", masuk: 43, keluar: 22 },
];

const activities = [
  {
    title: "Surat masuk dari Dinas Pendidikan",
    date: "13 Mei 2024, 10:30",
  },
  {
    title: "Surat keluar ke Dinas Kesehatan",
    date: "13 Mei 2024, 09:15",
  },
  {
    title: "Upload arsip Proposal Kegiatan",
    date: "12 Mei 2024, 16:45",
  },
  {
    title: "Surat masuk dari Dinas PU",
    date: "12 Mei 2024, 14:20",
  },
  {
    title: "Surat keluar ke Dinas Sosial",
    date: "12 Mei 2024, 11:05",
  },
];

const cards = [
  {
    title: "Surat Masuk",
    value: stats.suratMasuk,
    color: "bg-blue-500",
  },
  {
    title: "Surat Keluar",
    value: stats.suratKeluar,
    color: "bg-green-500",
  },
  {
    title: "Total Arsip",
    value: stats.totalArsip,
    color: "bg-purple-500",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [stats, setStats] = useState({
    suratMasuk: 0,
    suratKeluar: 0,
    totalArsip: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    }
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [masukRes, keluarRes] = await Promise.all([
          api.get("/surat-masuk"),
          api.get("/surat-keluar"),
        ]);

        const suratMasuk = masukRes.data.length;
        const suratKeluar = keluarRes.data.length;

        setStats({
          suratMasuk,
          suratKeluar,
          totalArsip: suratMasuk + suratKeluar,
        });
      } catch (error) {
        console.error("Dashboard Error:", error);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">
      {/* Sidebar */}
      <Sidebar open={open} setOpen={setOpen} />

      {/* Main */}
      <main className="flex-1">
        {/* Navbar */}

        <Navbar open={open} setOpen={setOpen} />

        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {cards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-lg ${card.color}`}
                  />
                  <div>
                    <h3 className="text-gray-500 text-sm">
                      {card.title}
                    </h3>
                    <p className="text-3xl font-bold">
                      {card.value}
                    </p>
                  </div>
                </div>

                <button className="text-blue-600 text-sm mt-4 hover:underline">
                  Lihat detail →
                </button>
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
            {/* Chart */}
            <div className="xl:col-span-2 bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold mb-5">
                Grafik Arsip (6 Bulan Terakhir)
              </h2>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="masuk"
                      stroke="#2563eb"
                      strokeWidth={3}
                    />

                    <Line
                      type="monotone"
                      dataKey="keluar"
                      stroke="#16a34a"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold mb-5">
                Aktivitas Terbaru
              </h2>

              <div className="space-y-4">
                {activities.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between gap-3 border-b pb-3"
                  >
                    <span className="text-sm text-gray-700">
                      {item.title}
                    </span>

                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {item.date}
                    </span>
                  </div>
                ))}
              </div>

              <button className="mt-5 text-blue-600 text-sm hover:underline">
                Lihat semua aktivitas →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MenuItem({ icon, text, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
        active
          ? "bg-blue-600"
          : "hover:bg-blue-700"
      }`}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}