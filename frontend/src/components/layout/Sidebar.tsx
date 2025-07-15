import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      icon: 'fas fa-home',
      text: 'Dashboard',
      description: 'Overview and metrics'
    },
    {
      path: '/scanner',
      icon: 'fas fa-search',
      text: 'Scanner',
      description: 'Market scanner and alerts'
    },
    {
      path: '/analysis',
      icon: 'fas fa-chart-bar',
      text: 'Analysis',
      description: 'Trading analysis and reports'
    },
    {
      path: '/historical',
      icon: 'fas fa-database',
      text: 'Historical Data',
      description: 'Manage market data for backtesting'
    },
    {
      path: '/backtest',
      icon: 'fas fa-flask',
      text: 'Backtest',
      description: 'Strategy backtesting and optimization'
    },
    {
      path: '/admin',
      icon: 'fas fa-shield-alt',
      text: 'Admin',
      description: 'System configuration'
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <i className="fas fa-chart-line"></i>
        </div>
        <div className="brand-name">TradeClarity</div>
      </div>
      
      <nav className="nav-menu">
        {navItems.map((item) => (
          <div key={item.path} className="nav-item">
            <Link 
              to={item.path} 
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <i className={`${item.icon} nav-icon`}></i>
              <div>
                <div className="nav-text">{item.text}</div>
                <div className="nav-description">{item.description}</div>
              </div>
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar; 