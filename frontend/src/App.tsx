import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FaProjectDiagram, FaUsers, FaBars, FaTimes } from 'react-icons/fa';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import EmployeeList from './pages/EmployeeList';
import EmployeeDetail from './pages/EmployeeDetail';
import './App.css';

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const navigationItems = [
    { path: '/', label: 'プロジェクト一覧', icon: FaProjectDiagram },
    { path: '/employees', label: '社員一覧', icon: FaUsers },
  ];

  return (
    <div className="app-container">
      {/* サイドバー */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <div className="app-title">
            {sidebarOpen && <span>プロジェクト管理</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === '/' && location.pathname.startsWith('/projects'));
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={!sidebarOpen ? item.label : ''}
              >
                <span className="nav-icon">
                  <item.icon size={18} />
                </span>
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className={`main-content ${sidebarOpen ? 'content-with-sidebar' : 'content-full'}`}>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;