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
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
};

const state = {
    studentSnapshot: null,
    studentUpdatedAt: null,
    commands: [],
    nextCommandId: 1,
    latestAckedCommandId: 0,
    lastStudentAck: null
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
        const isCodeAsset = extension === '.html' || extension === '.js' || extension === '.css';

        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': isCodeAsset ? 'no-store' : 'public, max-age=60'
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
            updatedAt: state.studentUpdatedAt,
            commandAck: state.lastStudentAck,
            latestAckedCommandId: state.latestAckedCommandId
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/student-state') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                if (!payload.frames && state.studentSnapshot && state.studentSnapshot.frames) {
                    payload.frames = state.studentSnapshot.frames;
                }
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
                console.log(`[command] ricevuto da docente: id=${command.id} tipo=${command.type}`);
                sendJson(response, 200, { ok: true, command });
            })
            .catch((error) => {
                console.log(`[command] errore: ${error.message}`);
                sendJson(response, 400, { error: error.message || 'Comando non valido.' });
            });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/commands') {
        const after = Number(url.searchParams.get('after') || 0);
        const latestCommandId = state.commands.length > 0
            ? state.commands[state.commands.length - 1].id
            : 0;
        // If the client's cursor is beyond what we know (e.g. server was restarted while
        // the student tab kept its old counter), reset it to 0 so new commands surface.
        const sanitizedAfter = after > latestCommandId ? 0 : after;
        const effectiveAfter = Math.max(sanitizedAfter, state.latestAckedCommandId);
        const commands = state.commands.filter((command) => command.id > effectiveAfter);

        if (commands.length > 0) {
            const ids = commands.map((command) => `${command.id}:${command.type}`).join(', ');
            console.log(`[command] consegna allo studente (after=${after}): ${ids}`);
        }

        sendJson(response, 200, {
            commands,
            latestCommandId,
            ackedCommandId: state.latestAckedCommandId
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/command-ack') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                const commandId = Number(payload.id);
                if (!Number.isFinite(commandId) || commandId <= 0) {
                    throw new Error('ID comando non valido.');
                }

                state.latestAckedCommandId = Math.max(state.latestAckedCommandId, commandId);
                state.lastStudentAck = {
                    id: commandId,
                    type: String(payload.type || ''),
                    status: payload.status === 'error' ? 'error' : 'ok',
                    message: String(payload.message || ''),
                    ackedAt: new Date().toISOString()
                };

                console.log(`[command] ack dallo studente: id=${commandId} tipo=${state.lastStudentAck.type} stato=${state.lastStudentAck.status}`);
                sendJson(response, 200, {
                    ok: true,
                    ackedCommandId: state.latestAckedCommandId,
                    commandAck: state.lastStudentAck
                });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Ack comando non valido.' });
            });
        return true;
    }

    return false;
}

function isPrivateIpv4(address) {
    if (address.startsWith('10.')) {
        return true;
    }

    if (address.startsWith('192.168.')) {
        return true;
    }

    const parts = address.split('.');
    if (parts.length !== 4) {
        return false;
    }

    const first = Number(parts[0]);
    const second = Number(parts[1]);
    return first === 172 && second >= 16 && second <= 31;
}

function interfaceLooksVirtual(name) {
    return /bluetooth|docker|hyper-v|loopback|nord|openvpn|tailscale|tun|virtual|vmware|vbox|vethernet|vpn|wsl/i.test(name);
}

function buildPageUrls(host) {
    return [
        `http://${host}:${PORT}/`,
        `http://${host}:${PORT}/teacher.html`
    ];
}

function printAvailableUrls() {
    const interfaces = os.networkInterfaces();
    const lanUrls = [];
    const otherNetworkUrls = [];

    Object.entries(interfaces).forEach(([name, addresses]) => {
        (addresses || []).forEach((address) => {
            if (address.family !== 'IPv4' || address.internal) {
                return;
            }

            const entry = {
                name,
                address: address.address,
                urls: buildPageUrls(address.address)
            };

            const isLikelyLan = isPrivateIpv4(address.address) && !interfaceLooksVirtual(name);
            if (isLikelyLan) {
                lanUrls.push(entry);
            } else {
                otherNetworkUrls.push(entry);
            }
        });
    });

    console.log('');
    console.log('Server Ric_Facc attivo.');
    console.log('Apri il quiz studente sul PC con uno di questi URL locali:');
    buildPageUrls('localhost').forEach((entry) => console.log(`- ${entry}`));
    console.log('');

    if (lanUrls.length > 0) {
        console.log('URL consigliati per telefono o tablet sulla stessa rete Wi-Fi/LAN:');
        lanUrls.forEach((entry) => {
            console.log(`- ${entry.urls[0]}  [${entry.name}]`);
            console.log(`  docente: ${entry.urls[1]}`);
        });
        console.log('');
    }

    if (otherNetworkUrls.length > 0) {
        console.log('Altri indirizzi rilevati (VPN o schede virtuali, di solito NON vanno usati dal tablet):');
        otherNetworkUrls.forEach((entry) => console.log(`- ${entry.address}  [${entry.name}]`));
        console.log('');
    }

    console.log('Se telefono o tablet non aprono la pagina:');
    console.log('- verifica di usare un URL della sezione Wi-Fi/LAN');
    console.log('- controlla che il PC e il tablet siano sulla stessa rete');
    console.log('- se usi una VPN, prova a disattivarla');
    console.log('- in Windows Firewall consenti Node.js sulle reti private');
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

    if (url.pathname === '/debug') {
        serveStaticFile('/debug.html', response);
        return;
    }

    if (url.pathname === '/teacher-debug') {
        serveStaticFile('/teacher-debug.html', response);
        return;
    }

    serveStaticFile(url.pathname, response);
});

server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
        console.error('');
        console.error(`La porta ${PORT} e gia in uso.`);
        console.error('Il server potrebbe essere gia attivo in un altra finestra.');
        console.error('Chiudi l altro processo oppure avvia con una porta diversa, ad esempio:');
        console.error(`set PORT=${PORT + 1} && node server.js`);
        console.error('');
        process.exit(1);
        return;
    }

    console.error(error);
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    printAvailableUrls();
});
