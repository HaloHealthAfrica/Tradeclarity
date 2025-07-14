import React from 'react';

interface MetricCardProps {
  metric: {
    title: string;
    value: string;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: React.ComponentType<any>;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const Icon = metric.icon;

  const getChangeColor = () => {
    switch (metric.changeType) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-error';
      default:
        return 'text-muted';
    }
  };

  const getChangeIcon = () => {
    if (metric.change > 0) {
      return '↗';
    } else if (metric.change < 0) {
      return '↘';
    }
    return '→';
  };

  return (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon">
          <Icon className="w-6 h-6" />
        </div>
        <div className="metric-change">
          <span className={`change-value ${getChangeColor()}`}>
            {getChangeIcon()} {Math.abs(metric.change)}%
          </span>
        </div>
      </div>
      
      <div className="metric-content">
        <h3 className="metric-title">{metric.title}</h3>
        <p className="metric-value mono">{metric.value}</p>
      </div>

      <style jsx>{`
        .metric-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg);
          transition: all var(--transition-normal);
          position: relative;
          overflow: hidden;
        }

        .metric-card:hover {
          background: var(--card-hover);
          box-shadow: var(--shadow-lg);
          transform: translateY(-2px);
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--gradient-primary);
          opacity: 0;
          transition: opacity var(--transition-fast);
        }

        .metric-card:hover::before {
          opacity: 1;
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: var(--shadow-md);
        }

        .metric-change {
          display: flex;
          align-items: center;
        }

        .change-value {
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .metric-content {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .metric-title {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-muted);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        @media (max-width: 768px) {
          .metric-card {
            padding: var(--spacing-md);
          }

          .metric-value {
            font-size: 1.25rem;
          }

          .metric-icon {
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default MetricCard; 