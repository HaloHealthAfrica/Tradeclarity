import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts';
import { format } from 'date-fns';
import { createModuleLogger } from '../../../utils/logger';

const logger = createModuleLogger('PriceChart');

interface PriceChartProps {
  symbol: string;
  data: CandlestickData[];
  height?: number;
  width?: number;
  theme?: 'light' | 'dark';
  showVolume?: boolean;
  realTime?: boolean;
  onDataUpdate?: (data: CandlestickData[]) => void;
}

interface ChartData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  symbol,
  data,
  height = 400,
  width,
  theme = 'dark',
  showVolume = true,
  realTime = false,
  onDataUpdate
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      // Create chart
      const chart = createChart(chartContainerRef.current, {
        width: width || chartContainerRef.current.clientWidth,
        height,
        layout: {
          background: { color: theme === 'dark' ? '#1a1a1a' : '#ffffff' },
          textColor: theme === 'dark' ? '#d1d4dc' : '#131722',
        },
        grid: {
          vertLines: { color: theme === 'dark' ? '#2B2B43' : '#e1e3ef' },
          horzLines: { color: theme === 'dark' ? '#2B2B43' : '#e1e3ef' },
        },
        crosshair: {
          mode: 1,
        },
        rightPriceScale: {
          borderColor: theme === 'dark' ? '#2B2B43' : '#e1e3ef',
        },
        timeScale: {
          borderColor: theme === 'dark' ? '#2B2B43' : '#e1e3ef',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Add candlestick series
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
      });
      candlestickSeriesRef.current = candlestickSeries;

      // Add volume series if enabled
      if (showVolume) {
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
        volumeSeriesRef.current = volumeSeries;
      }

      // Set data
      if (data.length > 0) {
        candlestickSeries.setData(data);
        
        if (showVolume && volumeSeriesRef.current) {
          const volumeData = data.map(item => ({
            time: item.time,
            value: (item as any).volume || 0,
            color: item.close >= item.open ? '#26a69a' : '#ef5350',
          }));
          volumeSeriesRef.current.setData(volumeData);
        }
      }

      // Fit content
      chart.timeScale().fitContent();

      // Handle window resize
      const handleResize = () => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: width || chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chartRef.current) {
          chartRef.current.remove();
        }
      };
    } catch (err) {
      logger.error('Error creating chart:', err as Error);
      setError('Failed to create chart');
    }
  }, [theme, showVolume, width]);

  // Update data when it changes
  useEffect(() => {
    if (candlestickSeriesRef.current && data.length > 0) {
      try {
        candlestickSeriesRef.current.setData(data);
        
        if (showVolume && volumeSeriesRef.current) {
          const volumeData = data.map(item => ({
            time: item.time,
            value: (item as any).volume || 0,
            color: item.close >= item.open ? '#26a69a' : '#ef5350',
          }));
          volumeSeriesRef.current.setData(volumeData);
        }

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } catch (err) {
        logger.error('Error updating chart data:', err as Error);
        setError('Failed to update chart data');
      }
    }
  }, [data, showVolume]);

  // Real-time updates
  useEffect(() => {
    if (!realTime || !onDataUpdate) return;

    const interval = setInterval(() => {
      // Simulate real-time data updates
      // In a real implementation, this would come from WebSocket
      const lastData = data[data.length - 1];
      if (lastData) {
        const newData = {
          ...lastData,
          time: Date.now() / 1000,
          close: lastData.close * (1 + (Math.random() - 0.5) * 0.01),
          high: Math.max(lastData.high, lastData.close * (1 + Math.random() * 0.01)),
          low: Math.min(lastData.low, lastData.close * (1 - Math.random() * 0.01)),
          open: lastData.close,
        };
        onDataUpdate([...data.slice(0, -1), newData]);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [realTime, data, onDataUpdate]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold">Chart Error</div>
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {symbol} Price Chart
        </h3>
        {isLoading && (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-sm text-gray-500">Loading...</span>
          </div>
        )}
      </div>
      <div 
        ref={chartContainerRef} 
        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        style={{ height }}
      />
    </div>
  );
}; 