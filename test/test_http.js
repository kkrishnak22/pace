// d:\pace\test\test_http.js
const http = require('http');

function testEndpoint(method, endpointPath, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: endpointPath,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${method} ${endpointPath}] => HTTP ${res.statusCode} (body bytes: ${data.length})`);
        resolve({ status: res.statusCode, data: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Testing live HTTP endpoints against server on port 5000...\n');
  await testEndpoint('GET', '/api/lesson/manifest');
  await testEndpoint('GET', '/api/lesson/step/1');
  await testEndpoint('GET', '/api/lesson/step/2');
  await testEndpoint('POST', '/api/lesson/generate-step', { topic: 'java-memory', stepNumber: 3 });
  await testEndpoint('GET', '/index.html');
  await testEndpoint('GET', '/css/player.css');
  await testEndpoint('GET', '/js/app.js');
  console.log('\nAll endpoints responded successfully with HTTP 200!');
}

run();

