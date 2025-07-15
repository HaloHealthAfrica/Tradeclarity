#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking deployment readiness...\n');

// Check if .env file exists
if (!fs.existsSync('.env')) {
  console.log('❌ .env file not found!');
  console.log('📝 Please copy env.example to .env and configure your environment variables');
  console.log('   cp env.example .env');
  process.exit(1);
}

// Check required environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const requiredVars = [
  'TWELVEDATA_API_KEY',
  'ALPACA_API_KEY', 
  'ALPACA_API_SECRET',
  'JWT_SECRET',
  'DATABASE_URL'
];

const missingVars = requiredVars.filter(varName => {
  return !envContent.includes(`${varName}=`);
});

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📝 Please add these to your .env file');
  process.exit(1);
}

// Check if dist directory exists
if (!fs.existsSync('dist')) {
  console.log('📦 Building project...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Build failed! Please fix TypeScript errors first');
    process.exit(1);
  }
}

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.log('❌ Failed to install dependencies');
    process.exit(1);
  }
}

// Check if Docker is available (for Docker deployment)
try {
  execSync('docker --version', { stdio: 'ignore' });
  console.log('✅ Docker is available');
} catch (error) {
  console.log('⚠️  Docker not found - Docker deployment will not work');
}

// Check if Docker Compose is available
try {
  execSync('docker-compose --version', { stdio: 'ignore' });
  console.log('✅ Docker Compose is available');
} catch (error) {
  console.log('⚠️  Docker Compose not found - Docker deployment will not work');
}

console.log('\n✅ Deployment check completed!');
console.log('\n🚀 To deploy:');
console.log('   npm start                    # Start in production mode');
console.log('   npm run docker:up           # Start with Docker');
console.log('   npm run start:all           # Start all services'); 