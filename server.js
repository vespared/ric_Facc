const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const state = {
    studentSnapshot: null,
    studentUpdatedAt: null,
    commands: [],
    nextCommandId: 1
};

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, content, contentType = 'text/plain; charset=utf-8') {
    response.writeHead(statusCode, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    response.end(content);
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let data = '';

        request.on('data', (chunk) => {
            data += chunk;
            if (data.length > 2 * 1024 * 1024) {
                reject(new Error('Body troppo grande.'));
                request.destroy();
            }
        });

        request.on('end', () => {
            resolve(data);
        });

        request.on('error', reject);
    });
}

function safeResolveFile(urlPath) {
    const relativePath = urlPath === '/' ? '/index.html' : urlPath;
    const normalized = path.normalize(relativePath)
        .replace(/^[/\\]+/, '')
        .replace(/^(\.\.[/\\])+/, '');
    const absolutePath = path.join(ROOT_DIR, normalized);

    if (!absolutePath.startsWith(ROOT_DIR)) {
        return null;
    }

    return absolutePath;
}

function serveStaticFile(urlPath, response) {
    const resolvedPath = safeResolveFile(urlPath);
    if (!resolvedPath) {
        sendText(response, 403, 'Accesso negato.');
        return;
    }

    fs.stat(resolvedPath, (statError, stats) => {
        if (statError || !stats.isFile()) {
            sendText(response, 404, 'File non trovato.');
            return;
        }

        const extension = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';

        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=60'
        });

        fs.createReadStream(resolvedPath).pipe(response);
    });
}

function pruneCommands() {
    if (state.commands.length > 200) {
        state.commands = state.commands.slice(-200);
    }
}

function handleApiRequest(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/student-state') {
        sendJson(response, 200, {
            snapshot: state.studentSnapshot,
            updatedAt: state.studentUpdatedAt
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/student-state') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                state.studentSnapshot = payload;
                state.studentUpdatedAt = new Date().toISOString();
                sendJson(response, 200, { ok: true, updatedAt: state.studentUpdatedAt });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Payload studente non valido.' });
            });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/command') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                if (!payload.type) {
                    throw new Error('Tipo comando mancante.');
                }

                const command = {
                    id: state.nextCommandId,
                    type: payload.type,
                    payload: payload.payload || {},
                    createdAt: new Date().toISOString()
                };

                state.nextCommandId += 1;
                state.commands.push(command);
                pruneCommands();
                sendJson(response, 200, { ok: true, command });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Comando non valido.' });
            });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/commands') {
        const after = Number(url.searchParams.get('after') || 0);
        const commands = state.commands.filter((command) => command.id > after);
        const latestCommandId = state.commands.length > 0
            ? state.commands[state.commands.length - 1].id
            : 0;

        sendJson(response, 200, {
            commands,
            latestCommandId
        });
        return true;
    }

    return false;
}

function printAvailableUrls() {
    const interfaces = os.networkInterfaces();
    const urls = new Set([
        `http://localhost:${PORT}/`,
        `http://127.0.0.1:${PORT}/`,
        `http://localhost:${PORT}/teacher.html`
    ]);

    Object.values(interfaces).forEach((addresses) => {
        (addresses || []).forEach((address) => {
            if (address.family === 'IPv4' && !address.internal) {
                urls.add(`http://${address.address}:${PORT}/`);
                urls.add(`http://${address.address}:${PORT}/teacher.html`);
            }
        });
    });

    console.log('');
    console.log('Server Ric_Facc attivo.');
    console.log('Apri il quiz studente sul PC e il pannello docente sul tablet usando uno di questi URL:');
    urls.forEach((entry) => console.log(`- ${entry}`));
    console.log('');
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        response.end();
        return;
    }

    if (handleApiRequest(request, response, url)) {
        return;
    }

    if (url.pathname === '/teacher') {
        serveStaticFile('/teacher.html', response);
        return;
    }

    serveStaticFile(url.pathname, response);
});

server.listen(PORT, '0.0.0.0', () => {
    printAvailableUrls();
});
