const http = require('http');

// Test if port 3001 is available
const testPort = (port) => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(port, () => {
      server.close();
      resolve(true);
    });
    server.on('error', () => {
      resolve(false);
    });
  });
};

// Test server response
const testServer = async () => {
  console.log('Testing server...');
  
  const portAvailable = await testPort(3001);
  console.log(`Port 3001 available: ${portAvailable}`);
  
  if (!portAvailable) {
    console.log('Port 3001 is in use. Trying to start server on port 3002...');
    process.env.PORT = '3002';
  }
  
  try {
    require('./server-simple.js');
    console.log('Server started successfully');
  } catch (error) {
    console.error('Failed to start server:', error.message);
  }
};

testServer(); 