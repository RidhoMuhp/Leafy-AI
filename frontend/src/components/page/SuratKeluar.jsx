import { useState, useEffect } from "react";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";
import api from "../services/api";


export default function SuratKeluar() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true); 
        const response = await api.get("/surat-keluar");
        setData(response.data);
      } catch (error) {
        console.error("Error fetching surat keluar data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredData = data.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.nomor?.toLowerCase().includes(q) ||
      item.tujuan?.toLowerCase().includes(q) ||
      item.perihal?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">
      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1">
        <Navbar title="Surat Keluar" setOpen={setOpen}/>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 p-6">
          <h1 className="text-2xl font-bold">Surat Keluar</h1>

          <div className="flex items-center gap-3">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center"
              aria-label="Form Pencarian Surat Keluar"
            >
              <label htmlFor="search" className="sr-only">
                Cari surat keluar
              </label>
              <input
                id="search"
                type="text"
                placeholder="Cari nomor, tujuan, atau perihal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-80 border p-2 rounded"
              />
            </form>

            <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              + Tambah Surat
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 mx-6">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-slate-200">
                  <th scope="col" className="p-3 text-left">
                    No
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Nomor Surat
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Tujuan
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Perihal
                  </th>
                  <th scope="col" className="p-3 text-left">
                    Tanggal
                  </th>
                  <th scope="col" className="p-3 text-center">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Tidak ada data surat keluar.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">{item.nomor}</td>
                      <td className="p-3">{item.tujuan}</td>
                      <td className="p-3">{item.perihal}</td>
                      <td className="p-3">{item.tanggal}</td>

                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Detail surat ${item.nomor}`}
                            className="bg-green-500 text-white px-3 py-1 rounded"
                          >
                            Detail
                          </button>

                          <button
                            type="button"
                            aria-label={`Edit surat ${item.nomor}`}
                            className="bg-yellow-500 text-white px-3 py-1 rounded"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            aria-label={`Hapus surat ${item.nomor}`}
                            className="bg-red-500 text-white px-3 py-1 rounded"
                          >
                            Hapus
                          </button>
                        </div>
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