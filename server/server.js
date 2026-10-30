// d:\pace\server\server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { lessonManifest, preloadedSteps } = require('./lessonData');
const { generateDynamicStep } = require('./stepGenerator');

const PORT = process.env.PORT || 5000;
const CLIENT_DIR = path.resolve(__dirname, '..', 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  // Prevent directory traversal
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(CLIENT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTING ---
  
  // 1. GET /api/lesson/manifest
  if (method === 'GET' && pathname === '/api/lesson/manifest') {
    console.log(`[API] GET /api/lesson/manifest`);
    return sendJson(res, 200, {
      success: true,
      data: lessonManifest
    });
  }

  // 2. GET /api/lesson/step/:id
  const stepMatch = pathname.match(/^\/api\/lesson\/step\/(\d+)$/);
  if (method === 'GET' && stepMatch) {
    const stepNum = parseInt(stepMatch[1], 10);
    console.log(`[API] GET /api/lesson/step/${stepNum}`);

    if (preloadedSteps[stepNum]) {
      return sendJson(res, 200, {
        success: true,
        data: preloadedSteps[stepNum]
      });
    }

    // If step 3 requested via GET, synthesize it dynamically
    if (stepNum === 3) {
      const generated = generateDynamicStep({ stepNumber: 3 });
      return sendJson(res, 200, {
        success: true,
        data: generated
      });
    }

    return sendJson(res, 404, {
      success: false,
      error: `Step ${stepNum} not found`
    });
  }

  // 3. POST /api/lesson/generate-step (Dynamic On-Demand Synthesis)
  if (method === 'POST' && pathname === '/api/lesson/generate-step') {
    try {
      const body = await parseJsonBody(req);
      const stepNum = parseInt(body.stepNumber || 3, 10);
      const language = body.language || 'en';
      console.log(`[API] POST /api/lesson/generate-step -> Generating Step ${stepNum} (lang: ${language})...`);

      const generated = generateDynamicStep({
        topic: body.topic || 'java-memory',
        stepNumber: stepNum,
        language: language
      });

      return sendJson(res, 200, {
        success: true,
        data: generated
      });
    } catch (err) {
      console.error(`[API Error]`, err);
      return sendJson(res, 500, {
        success: false,
        error: 'Failed to generate step'
      });
    }
  }

  // --- STATIC ASSETS ---
  serveStaticFile(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Visual Lesson Engine Server running at:`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`   API Endpoint: http://localhost:${PORT}/api/lesson/manifest`);
  console.log(`   Client UI: http://localhost:${PORT}/index.html`);
  console.log(`======================================================\n`);
});

module.exports = server;

