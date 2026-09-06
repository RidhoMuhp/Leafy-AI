import { useState, useEffect } from "react";
import Navbar from "../ui/Navbar";
import Sidebar from "../ui/Sidebar";
import api from "../services/api";

export default function SuratMasuk() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editData) {
        await api.put(
          `/surat-masuk/${editData.id}`,
          formData
        );

        alert("Data berhasil diupdate");
      } else {
        await api.post(
          "/surat-masuk",
          formData
        );

        alert("Data berhasil ditambah");
      }

      await fetchData();

      setShowModal(false);

      setFormData({
        nomor: "",
        pengirim: "",
        perihal: "",
        tanggal: "",
      });

      setEditData(null);

    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Yakin ingin menghapus data?"
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/surat-masuk/${id}`);

      setData(
        data.filter((item) => item.id !== id)
      );

      alert("Data berhasil dihapus");
    } catch (error) {
      console.error(error);
    }
  };

  const [formData, setFormData] = useState({
    nomor: "",
    pengirim: "",
    perihal: "",
    tanggal: "",
  });

    const fetchData = async () => {
      try {
        const response = await api.get("/surat-masuk");

        console.log(response.data); 

        setData(response.data);
      } catch (error) {
        console.error("Error fetching surat masuk:", error);
      }
    };

    useEffect(() => {
      fetchData();
    }, []);

  const filteredData = data.filter(
    (item) =>
      (item.nomor || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (item.pengirim || "")
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="flex w-screen min-h-screen bg-slate-100">
      <Sidebar open={open} setOpen={setOpen} />

      <main className="flex-1">
        <Navbar
          title="Surat Masuk"
          setOpen={setOpen}
        />

        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <h1 className="text-2xl font-bold">
              Surat Masuk
            </h1>

            <input
              type="text"
              placeholder="Cari surat..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="w-full md:w-80 border p-2 rounded"
            />

            <button
            onClick={() => {
              setEditData(null);

              setFormData({
                nomor: "",
                pengirim: "",
                perihal: "",
                tanggal: "",
              });

              setShowModal(true);
            }} 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-800">
              + Tambah Surat
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="p-3 text-left">
                      No
                    </th>
                    <th className="p-3 text-left">
                      Nomor Surat
                    </th>
                    <th className="p-3 text-left">
                      Pengirim
                    </th>
                    <th className="p-3 text-left">
                      Perihal
                    </th>
                    <th className="p-3 text-left">
                      Tanggal
                    </th>
                    <th className="p-3 text-center">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="text-center p-6 text-gray-500"
                      >
                        Tidak ada data surat masuk
                      </td>
                    </tr>
                  ) : (
                    filteredData.map(
                      (item, index) => (
                        <tr
                          key={item.id}
                          className="border-b hover:bg-slate-50"
                        >
                          <td className="p-3">
                            {index + 1}
                          </td>

                          <td className="p-3">
                            {item.nomor}
                          </td>

                          <td className="p-3">
                            {item.pengirim}
                          </td>

                          <td className="p-3">
                            {item.perihal}
                          </td>

                          <td className="p-3">
                            {item.tanggal?.split("T")[0]}
                          </td>

                          <td className="p-3 text-center space-x-2">
                            <button className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">
                              Detail
                            </button>

                            <button
                            onClick={() => {
                              setEditData(item);

                              setFormData({
                                nomor: item.nomor || "",
                                pengirim: item.pengirim || "",
                                perihal: item.perihal || "",
                                tanggal: item.tanggal?.split("T")[0] || "",
                              });

                              setShowModal(true);
                            }} 
                            className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">
                              Edit
                            </button>

                            <button
                            onClick={() => handleDelete(item.id)} 
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                              Hapus
                            </button>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-white p-6 rounded-xl w-full max-w-lg">

              <h2 className="text-xl font-bold mb-4">
                {editData
                  ? "Edit Surat Masuk"
                  : "Tambah Surat Masuk"}
              </h2>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                <input
                  type="text"
                  placeholder="Nomor Surat"
                  value={formData.nomor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nomor: e.target.value,
                    })
                  }
                  className="w-full border p-2 rounded"
                  required
                />

                <input
                  type="text"
                  placeholder="Pengirim"
                  value={formData.pengirim}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pengirim: e.target.value,
                    })
                  }
                  className="w-full border p-2 rounded"
                  required
                />

                <input
                  type="text"
                  placeholder="Perihal"
                  value={formData.perihal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      perihal: e.target.value,
                    })
                  }
                  className="w-full border p-2 rounded"
                  required
                />

                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tanggal: e.target.value,
                    })
                  }
                  className="w-full border p-2 rounded"
                  required
                />

                <div className="flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-gray-300 rounded"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Simpan
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}