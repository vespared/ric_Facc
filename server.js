const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const AUTO_OPEN_STUDENT = process.env.AUTO_OPEN_STUDENT === '1' ||
    process.env.AUTO_OPEN_STUDENT !== '0' ||
    process.argv.includes('--auto-open-student');

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
    lastStudentAck: null,
    lastTeacherPing: 0,
    studentBrowserOpened: false
};

function openStudentBrowser() {
    if (state.studentBrowserOpened) {
        return;
    }

    const isStudentAlreadyActive = state.studentUpdatedAt &&
        (Date.now() - new Date(state.studentUpdatedAt).getTime()) < 10000;
    if (isStudentAlreadyActive) {
        state.studentBrowserOpened = true;
        console.log('[server] Pagina studente gia attiva in un browser.');
        return;
    }

    state.studentBrowserOpened = true;
    const studentUrl = `http://localhost:${PORT}/`;
    console.log('');
    console.log('============================================================');
    console.log('[server] QR code acquisito dal docente!');
    console.log(`[server] Avvio automatico pagina studente nel browser: ${studentUrl}`);
    console.log('============================================================');
    console.log('');

    if (process.platform === 'win32') {
        if (process.env.STUDENT_KIOSK === '1') {
            exec(`powershell -NoProfile -WindowStyle Hidden -Command "try { Start-Process 'msedge' -ArgumentList '--kiosk','${studentUrl}','--edge-kiosk-type=fullscreen','--no-first-run','--no-default-browser-check' -ErrorAction Stop } catch { Start-Process '${studentUrl}' }"`);
        } else {
            exec(`start "" "${studentUrl}"`, (error) => {
                if (error) {
                    console.warn('[server] Avviso apertura browser con start:', error.message);
                    exec(`powershell -NoProfile -WindowStyle Hidden -Command "Start-Process '${studentUrl}'"`);
                }
            });
        }
    } else if (process.platform === 'darwin') {
        exec(`open "${studentUrl}"`);
    } else {
        exec(`xdg-open "${studentUrl}"`);
    }
}

function noteTeacherActivity() {
    state.lastTeacherPing = Date.now();
    if (AUTO_OPEN_STUDENT) {
        openStudentBrowser();
    }
}

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
    if (request.method === 'GET' && url.pathname === '/api/network-info') {
        sendJson(response, 200, getNetworkDetails());
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/open-student') {
        openStudentBrowser();
        sendJson(response, 200, { ok: true, opened: state.studentBrowserOpened });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/student-state') {
        noteTeacherActivity();
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
                state.studentBrowserOpened = true;
                sendJson(response, 200, { ok: true, updatedAt: state.studentUpdatedAt });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Payload studente non valido.' });
            });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/command') {
        noteTeacherActivity();
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
        `http://${host}:${PORT}/teacher`
    ];
}

function getNetworkDetails() {
    const interfaces = os.networkInterfaces();
    const lan = [];
    const others = [];

    Object.entries(interfaces).forEach(([name, addresses]) => {
        (addresses || []).forEach((address) => {
            if (address.family !== 'IPv4' || address.internal) {
                return;
            }

            const isWifi = /wi-?fi|wlan|wireless/i.test(name);
            const isLikelyLan = isPrivateIpv4(address.address) && !interfaceLooksVirtual(name);
            const entry = {
                name,
                address: address.address,
                isWifi,
                teacherUrl: `http://${address.address}:${PORT}/teacher`,
                studentUrl: `http://${address.address}:${PORT}/`
            };

            if (isLikelyLan) {
                lan.push(entry);
            } else {
                others.push(entry);
            }
        });
    });

    lan.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));

    const defaultIp = lan.length > 0 ? lan[0].address : 'localhost';
    const teacherActive = (Date.now() - (state.lastTeacherPing || 0)) < 7000;

    return {
        port: PORT,
        defaultIp,
        teacherUrl: `http://${defaultIp}:${PORT}/teacher`,
        studentUrl: `http://${defaultIp}:${PORT}/`,
        lan,
        others,
        teacherConnected: teacherActive,
        studentOpened: state.studentBrowserOpened
    };
}

function printAvailableUrls() {
    const netInfo = getNetworkDetails();

    console.log('');
    console.log(`Server Ric_Facc attivo sulla porta ${PORT}.`);
    console.log('Quiz studente su questo PC:');
    console.log(`- ${netInfo.studentUrl}`);
    console.log(`- http://localhost:${PORT}/`);
    console.log('');

    if (AUTO_OPEN_STUDENT) {
        console.log('Apertura automatica studente: ATTIVA');
        console.log('(appena il docente inquadra il QR code, la pagina studente si aprira nel browser di questo PC)');
        console.log('');
    }

    if (netInfo.lan.length > 0) {
        console.log('URL per smartphone o tablet docente (stessa rete Wi-Fi):');
        netInfo.lan.forEach((entry) => {
            const tag = entry.isWifi ? ' [CONSIGLIATO - Wi-Fi]' : ` [${entry.name}]`;
            console.log(`- Docente:  ${entry.teacherUrl}${tag}`);
            console.log(`  Studente: ${entry.studentUrl}`);
        });
        console.log('');
    }

    if (netInfo.others.length > 0) {
        console.log('Altri indirizzi rilevati (VPN o virtuali):');
        netInfo.others.forEach((entry) => console.log(`- ${entry.address} [${entry.name}]`));
        console.log('');
    }

    try {
        const qrcode = require('./qrcode.min.js');
        const qr = qrcode(0, 'L');
        qr.addData(netInfo.teacherUrl);
        qr.make();
        console.log('============================================================');
        console.log('  QR CODE COLLEGAMENTO DOCENTE (scansiona con smartphone/tablet)');
        console.log('  ' + netInfo.teacherUrl);
        console.log('============================================================');
        console.log(qr.createASCII(1, 1));
        console.log('============================================================');
    } catch (e) {
        // Se la stampa ascii fallisce, si prosegue regolarmente
    }

    console.log('');
    console.log(`Riquadro grafico QR disponibile su: http://localhost:${PORT}/connetti.html`);
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

    if (url.pathname === '/connetti' || url.pathname === '/qr') {
        serveStaticFile('/connetti.html', response);
        return;
    }

    if (url.pathname === '/teacher' || url.pathname === '/docente' || url.pathname === '/teacher.html') {
        noteTeacherActivity();
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
