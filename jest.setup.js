// Jest setup file
global.console = {
  ...console,
  // Uncomment to suppress console.log during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-secret';
process.env.TWELVEDATA_API_KEY = 'test-api-key';
process.env.ALPACA_API_KEY = 'test-alpaca-key';
process.env.ALPACA_SECRET_KEY = 'test-alpaca-secret';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-password';
process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';

// Global test timeout
jest.setTimeout(10000);

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }
  
  send(data) {
    // Mock send method
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
};

// Mock fetch
global.fetch = jest.fn();

// Mock crypto for JWT
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: (size) => crypto.randomBytes(size),
    createHash: (algorithm) => crypto.createHash(algorithm),
    createHmac: (algorithm, key) => crypto.createHmac(algorithm, key)
  }
}); 