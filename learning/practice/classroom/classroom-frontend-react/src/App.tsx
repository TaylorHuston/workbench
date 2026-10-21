import DashboardPage from './pages/DashboardPage'
import SubjectsListPage from './pages/subjects/SubjectsListPage'
import SubjectCreatePage from './pages/subjects/SubjectCreatePage'
import AppLayout from './components/layout/AppLayout'
import { Routes, Route } from 'react-router'
import './App.css'

function App() {
  return (
    <>

      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/subjects" element={<SubjectsListPage />} />
          <Route path="/subjects/create" element={<SubjectCreatePage />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
