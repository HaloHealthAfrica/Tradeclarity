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
    </div>
  );
};

export default MetricCard; 