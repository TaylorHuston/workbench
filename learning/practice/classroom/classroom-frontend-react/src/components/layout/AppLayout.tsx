import { NavLink, Outlet } from 'react-router'

const AppLayout = () => {
  return (
    <div className="app-layout">
      <nav className="app-sidebar">
        <NavLink className={({ isActive }) => isActive ? "nav-link is-active" : "nav-link"} to="/" end>Dashboard</NavLink>
        <NavLink className={({ isActive }) => isActive ? "nav-link is-active" : "nav-link"} to="/subjects">Subjects</NavLink>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout