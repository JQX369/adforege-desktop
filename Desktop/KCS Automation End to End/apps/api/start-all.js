/**
 * KCS Automation - Full Stack Startup Script
 * Runs both Next.js server (dashboard) AND BullMQ workers
 * Perfect for Railway single-container deployment
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 KCS Automation - Starting Full Stack...');
console.log('📍 Working Directory:', process.cwd());
console.log('🌍 Environment:', process.env.NODE_ENV);
console.log('🔌 Port:', process.env.PORT || 3000);

// Start Next.js server (dashboard)
console.log('\n📊 Starting Next.js Dashboard Server...');
const nextServer = spawn('node', ['apps/api/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || 3000 }
});

nextServer.on('error', (error) => {
  console.error('❌ Next.js server error:', error);
  process.exit(1);
});

nextServer.on('exit', (code) => {
  console.log(`Next.js server exited with code ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Wait 5 seconds for Next.js to start, then start workers
setTimeout(() => {
  console.log('\n⚙️ Starting BullMQ Workers...');
  const workers = spawn('node', ['apps/api/workers/start.js'], {
    stdio: 'inherit',
    env: process.env
  });

  workers.on('error', (error) => {
    console.error('❌ Workers error:', error);
  });

  workers.on('exit', (code) => {
    console.log(`Workers exited with code ${code}`);
  });

  console.log('✨ Full stack initialization complete!');
  console.log('🌐 Dashboard: http://localhost:' + (process.env.PORT || 3000));
  console.log('📈 Metrics: http://localhost:' + (process.env.PORT || 3000) + '/api/metrics');
  console.log('💚 Health: http://localhost:' + (process.env.PORT || 3000) + '/api/health');
}, 5000);

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
  nextServer.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

