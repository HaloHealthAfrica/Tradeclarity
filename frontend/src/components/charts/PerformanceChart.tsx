import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format } from 'date-fns';

interface PerformanceData {
  date: string;
  equity: number;
  drawdown: number;
  trades: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
  type: 'equity' | 'drawdown' | 'trades' | 'monthly-returns';
  height?: number;
  theme?: 'light' | 'dark';
  showGrid?: boolean;
  animate?: boolean;
}

interface MonthlyReturnData {
  month: string;
  return: number;
  trades: number;
  winRate: number;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  type,
  height = 300,
  theme = 'dark',
  showGrid = true,
  animate = true,
}) => {
  const isDark = theme === 'dark';
  const colors = {
    primary: isDark ? '#3b82f6' : '#2563eb',
    secondary: isDark ? '#10b981' : '#059669',
    negative: isDark ? '#ef4444' : '#dc2626',
    background: isDark ? '#1f2937' : '#ffffff',
    text: isDark ? '#f3f4f6' : '#1f2937',
    grid: isDark ? '#374151' : '#e5e7eb',
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM dd');
    } catch {
      return date;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderEquityChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke={colors.text}
          fontSize={12}
        />
        <YAxis
          tickFormatter={formatCurrency}
          stroke={colors.text}
          fontSize={12}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke={colors.primary}
          fill="url(#equityGradient)"
          strokeWidth={2}
          name="Equity"
          isAnimationActive={animate}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderDrawdownChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.negative} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.negative} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke={colors.text}
          fontSize={12}
        />
        <YAxis
          tickFormatter={formatPercentage}
          stroke={colors.text}
          fontSize={12}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke={colors.negative}
          fill="url(#drawdownGradient)"
          strokeWidth={2}
          name="Drawdown"
          isAnimationActive={animate}
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderTradesChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        )}
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke={colors.text}
          fontSize={12}
        />
        <YAxis stroke={colors.text} fontSize={12} />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="trades"
          fill={colors.secondary}
          name="Trades"
          isAnimationActive={animate}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderMonthlyReturnsChart = () => {
    // Transform data for monthly returns
    const monthlyData = data.reduce((acc: any[], item) => {
      const month = item.date.substring(0, 7); // YYYY-MM
      const existing = acc.find(d => d.month === month);
      
      if (existing) {
        existing.trades += item.trades;
      } else {
        acc.push({
          month,
          trades: item.trades,
          return: 0, // This would come from actual monthly return data
        });
      }
      
      return acc;
    }, []);

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          )}
          <XAxis
            dataKey="month"
            stroke={colors.text}
            fontSize={12}
          />
          <YAxis stroke={colors.text} fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="trades"
            fill={colors.primary}
            name="Monthly Trades"
            isAnimationActive={animate}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'equity':
        return renderEquityChart();
      case 'drawdown':
        return renderDrawdownChart();
      case 'trades':
        return renderTradesChart();
      case 'monthly-returns':
        return renderMonthlyReturnsChart();
      default:
        return renderEquityChart();
    }
  };

  const getChartTitle = () => {
    switch (type) {
      case 'equity':
        return 'Equity Curve';
      case 'drawdown':
        return 'Drawdown';
      case 'trades':
        return 'Daily Trades';
      case 'monthly-returns':
        return 'Monthly Performance';
      default:
        return 'Performance Chart';
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
            No Data Available
          </div>
          <div className="text-gray-400 dark:text-gray-500 text-sm">
            {getChartTitle()} data will appear here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {getChartTitle()}
        </h3>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        {renderChart()}
      </div>
    </div>
  );
}; 