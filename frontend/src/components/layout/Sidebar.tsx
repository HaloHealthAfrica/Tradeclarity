import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  ChartBarIcon, 
  CogIcon, 
  HomeIcon, 
  MagnifyingGlassIcon,
  ChartPieIcon,
  UserIcon,
  BellIcon,
  ArrowTrendingUpIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

const Sidebar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      description: 'Overview and key metrics'
    },
    {
      name: 'Scanner',
      href: '/scanner',
      icon: MagnifyingGlassIcon,
      description: 'Real-time market scanner'
    },
    {
      name: 'Analysis',
      href: '/analysis',
      icon: BeakerIcon,
      description: 'Backtesting and optimization'
    },
    {
      name: 'Strategies',
      href: '/strategies',
      icon: ChartBarIcon,
      description: 'Manage trading strategies'
    },
    {
      name: 'Portfolio',
      href: '/portfolio',
      icon: ChartPieIcon,
      description: 'Portfolio management'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: ArrowTrendingUpIcon,
      description: 'Performance analytics'
    }
  ];

  const secondaryNavigation = [
    {
      name: 'Settings',
      href: '/settings',
      icon: CogIcon,
      description: 'System configuration'
    }
  ];

  return (
    <div className="sidebar">
      {/* Logo and Brand */}
      <div className="sidebar-header">
        <div className="brand">
          <div className="brand-logo">
            <ChartBarIcon className="w-8 h-8 text-primary-blue" />
          </div>
          <div className="brand-text">
            <h1 className="brand-title">TradeFlow</h1>
            <p className="brand-subtitle">Pro Trading</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">Trading</h3>
          <ul className="nav-list">
            {navigation.map((item) => (
              <li key={item.name} className="nav-item">
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                  title={item.description}
                >
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>

        {/* Secondary Navigation */}
        <div className="nav-section">
          <h3 className="nav-section-title">System</h3>
          <ul className="nav-list">
            {secondaryNavigation.map((item) => (
              <li key={item.name} className="nav-item">
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                  title={item.description}
                >
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>

        {/* User Profile */}
        <div className="user-profile">
          <div className="user-avatar">
            <UserIcon className="w-6 h-6" />
          </div>
          <div className="user-info">
            <p className="user-name">John Doe</p>
            <p className="user-role">Trader</p>
          </div>
          <button className="notifications-btn" title="Notifications">
            <BellIcon className="w-5 h-5" />
            <span className="notification-badge">3</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .sidebar {
          width: 280px;
          height: 100vh;
          background: var(--card-bg);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          z-index: var(--z-fixed);
        }

        .sidebar-header {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--border-color);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .brand-logo {
          width: 48px;
          height: 48px;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-md);
        }

        .brand-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .brand-subtitle {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sidebar-nav {
          flex: 1;
          padding: var(--spacing-lg);
          overflow-y: auto;
        }

        .nav-section {
          margin-bottom: var(--spacing-xl);
        }

        .nav-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--spacing-md);
        }

        .nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .nav-item {
          margin-bottom: var(--spacing-xs);
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          text-decoration: none;
          transition: all var(--transition-fast);
          position: relative;
        }

        .nav-link:hover {
          background: var(--card-hover);
          color: var(--text-primary);
        }

        .nav-link-active {
          background: var(--primary-blue);
          color: white;
          box-shadow: var(--shadow-glow);
        }

        .nav-link-active:hover {
          background: var(--primary-blue-hover);
        }

        .nav-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .nav-text {
          font-weight: 500;
          font-size: 0.875rem;
        }

        .sidebar-footer {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--border-color);
          background: var(--secondary-bg);
        }

        .theme-toggle {
          width: 100%;
          padding: var(--spacing-sm);
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-bottom: var(--spacing-md);
        }

        .theme-toggle:hover {
          background: var(--card-hover);
          color: var(--text-primary);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          padding: var(--spacing-md);
          background: var(--card-bg);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          background: var(--gradient-primary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 0;
        }

        .notifications-btn {
          position: relative;
          padding: var(--spacing-xs);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }

        .notifications-btn:hover {
          background: var(--card-hover);
          color: var(--text-primary);
        }

        .notification-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 16px;
          height: 16px;
          background: var(--primary-red);
          color: white;
          border-radius: 50%;
          font-size: 0.625rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform var(--transition-normal);
          }

          .sidebar.open {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Sidebar; 