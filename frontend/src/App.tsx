import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireProfile from './components/RequireProfile'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import CreateGameForm from './components/CreateGameForm'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/home"
            element={
              <RequireProfile>
                <Home />
              </RequireProfile>
            }
          />
          <Route
            path="/admin/create-game"
            element={
              <RequireProfile>
                <CreateGameForm />
              </RequireProfile>
            }
          />
          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App 