const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

// Serve static files from frontend/src (for development)
app.use(express.static(path.join(__dirname, 'frontend/src')));

// API endpoints (same as your main server)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Dev server running on port ' + port
  });
});

app.get('/api/scanner/status', (req, res) => {
  res.json({
    isRunning: true,
    activeSymbols: ['AAPL', 'MSFT', 'GOOGL', 'TSLA'],
    lastScan: new Date().toISOString()
  });
});

app.get('/api/scanner/results', (req, res) => {
  res.json({
    results: [
      {
        symbol: 'AAPL',
        pattern: 'Bullish Breakout',
        confidence: 0.85,
        price: 150.25,
        volume: 45000000,
        timestamp: new Date().toISOString(),
        indicators: {
          rsi: 65.2,
          macd: 0.45,
          ema: 148.90
        }
      },
      {
        symbol: 'TSLA',
        pattern: 'Squeeze Release',
        confidence: 0.78,
        price: 245.80,
        volume: 32000000,
        timestamp: new Date().toISOString(),
        indicators: {
          rsi: 72.1,
          macd: -0.12,
          ema: 242.30
        }
      }
    ]
  });
});

app.post('/api/scanner/start', (req, res) => {
  res.json({
    status: 'scanner_started',
    message: 'Scanner started successfully'
  });
});

app.post('/api/scanner/stop', (req, res) => {
  res.json({
    status: 'scanner_stopped',
    message: 'Scanner stopped successfully'
  });
});

// Serve the React app
app.get('*', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Paper Trading System - Dev</title>
      <style>
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
        #root { height: 100vh; }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script>
        // Simple React-like development setup
        console.log('Development server running on port ${port}');
        console.log('Scanner page should be available at http://localhost:${port}/scanner');
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Development server running on port ${port}`);
  console.log(`Scanner page: http://localhost:${port}/scanner`);
}); 