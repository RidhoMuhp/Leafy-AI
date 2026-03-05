import { useState } from 'react'
import './App.css'
import HomePage from './components/page/Home'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="">
      <HomePage />
    </div>
  )
}

export default App
