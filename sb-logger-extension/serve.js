#!/usr/bin/env node
/**
 * Simple local HTTP server for testing The Odds API integration
 * Run: node serve.js
 * Then open: http://localhost:3000/test_odds_api.html
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // Parse URL
  let filePath = req.url === '/' ? '/test_odds_api.html' : req.url;
  
  // Remove query string
  if (filePath.includes('?')) {
    filePath = filePath.split('?')[0];
  }

  filePath = path.join(ROOT_DIR, filePath);

  // Security: prevent directory traversal
  const realPath = path.resolve(filePath);
  if (!realPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.log(`404 - Not found: ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // Get MIME type
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Read and serve file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.log(`500 - Error reading file: ${req.url}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }

      // Add CORS headers
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
      console.log(`200 - ${req.url}`);
    });
  });
});

server.listen(PORT, 'localhost', () => {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 The Odds API Test Server Started                       ║');
  console.log(`║                                                            ║`);
  console.log(`║  📍 Open: http://localhost:${PORT}/test_odds_api.html       ║`);
  console.log('║                                                            ║');
  console.log('║  Press Ctrl+C to stop the server                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port or stop the other server.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
