import {Routes, Route} from 'react-router-dom'
import { useState } from 'react'
import './App.css'
import Login from './components/page/Login'
import Dashboard from './components/page/Dashboard'
import SuratMasuk from './components/page/SuratMasuk'
import SuratKeluar from './components/page/SuratKeluar'
import Arsip from './components/page/arsip'
import Laporan from './components/page/Laporan'
import Pengaturan from './components/page/Pengaturan'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/surat-masuk" element={<SuratMasuk />} />
      <Route path="/surat-keluar" element={<SuratKeluar />} />
      <Route path="/arsip" element={<Arsip />} />
      <Route path="/laporan" element={<Laporan />} />
      <Route path="/pengaturan" element={<Pengaturan />} />
    </Routes>
  )
}

export default App
