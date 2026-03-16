const SNAPSHOT_REFRESH_MS = 500;

const teacherDebugConnectionStatus = document.getElementById('teacherDebugConnectionStatus');
const teacherDebugPhaseBadge = document.getElementById('teacherDebugPhaseBadge');
const teacherDebugQuestionBadge = document.getElementById('teacherDebugQuestionBadge');
const teacherDebugLastUpdate = document.getElementById('teacherDebugLastUpdate');
const teacherDebugQuestionTitle = document.getElementById('teacherDebugQuestionTitle');
const teacherDebugQuestionCounter = document.getElementById('teacherDebugQuestionCounter');
const teacherDebugQuestionPrompt = document.getElementById('teacherDebugQuestionPrompt');
const teacherDebugStatePill = document.getElementById('teacherDebugStatePill');
const teacherDebugCameraState = document.getElementById('teacherDebugCameraState');
const teacherDebugCameraFeedStatus = document.getElementById('teacherDebugCameraFeedStatus');
const teacherDebugCommandState = document.getElementById('teacherDebugCommandState');
const teacherDebugMachineState = document.getElementById('teacherDebugMachineState');
const teacherDebugFaceDetected = document.getElementById('teacherDebugFaceDetected');
const teacherDebugProfileStatus = document.getElementById('teacherDebugProfileStatus');
const teacherDebugEarProfile = document.getElementById('teacherDebugEarProfile');
const teacherDebugMarProfile = document.getElementById('teacherDebugMarProfile');
const teacherDebugGlassesProfile = document.getElementById('teacherDebugGlassesProfile');
const teacherDebugEventLog = document.getElementById('teacherDebugEventLog');

const teacherDebugLeftEar = document.getElementById('teacherDebugLeftEar');
const teacherDebugRightEar = document.getElementById('teacherDebugRightEar');
const teacherDebugAverageEar = document.getElementById('teacherDebugAverageEar');
const teacherDebugMar = document.getElementById('teacherDebugMar');
const teacherDebugEarThreshold = document.getElementById('teacherDebugEarThreshold');
const teacherDebugRightEarThreshold = document.getElementById('teacherDebugRightEarThreshold');
const teacherDebugMarThreshold = document.getElementById('teacherDebugMarThreshold');

const teacherDebugLeftEyeCard = document.getElementById('teacherDebugLeftEyeCard');
const teacherDebugLeftEyeStatus = document.getElementById('teacherDebugLeftEyeStatus');
const teacherDebugRightEyeCard = document.getElementById('teacherDebugRightEyeCard');
const teacherDebugRightEyeStatus = document.getElementById('teacherDebugRightEyeStatus');
const teacherDebugMouthCard = document.getElementById('teacherDebugMouthCard');
const teacherDebugMouthStatus = document.getElementById('teacherDebugMouthStatus');
const teacherDebugTrackingFrame = document.getElementById('teacherDebugTrackingFrame');
const teacherDebugTrackingEmpty = document.getElementById('teacherDebugTrackingEmpty');
const teacherDebugZoomFrame = document.getElementById('teacherDebugZoomFrame');
const teacherDebugZoomEmpty = document.getElementById('teacherDebugZoomEmpty');

let snapshotTimer = null;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function fetchJson(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(payload.error || `Richiesta non riuscita (${response.status}).`);
    }

    return payload;
}

function formatMetric(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(3) : '0.000';
}

function setConnectionStatus(message, isError = false) {
    teacherDebugConnectionStatus.textContent = message;
    teacherDebugConnectionStatus.style.color = isError ? 'var(--red)' : 'var(--text)';
}

function setFrame(imageElement, placeholderElement, value) {
    if (!value) {
        imageElement.removeAttribute('src');
        placeholderElement.classList.remove('hidden');
        return;
    }

    imageElement.src = value;
    placeholderElement.classList.add('hidden');
}

function setSensorCard(cardElement, statusElement, sensor) {
    if (!sensor) {
        cardElement.classList.remove('state-open', 'state-closed');
        statusElement.textContent = 'ATTESA';
        return;
    }

    const isOpen = Boolean(sensor && sensor.isOpen);
    cardElement.classList.remove('state-open', 'state-closed');
    cardElement.classList.add(isOpen ? 'state-open' : 'state-closed');
    statusElement.textContent = sensor && sensor.status ? sensor.status : 'ATTESA';
}

function renderEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
        teacherDebugEventLog.innerHTML = '<li><span class="log-time">--:--:--</span><span class="log-text">Nessun evento disponibile.</span></li>';
        return;
    }

    teacherDebugEventLog.innerHTML = events.map((eventItem) => `
        <li>
            <span class="log-time">${escapeHtml(eventItem.time || '--:--:--')}</span>
            <span class="log-text">${escapeHtml(eventItem.message || '')}</span>
        </li>
    `).join('');
}

function renderDisconnectedState(message) {
    setConnectionStatus('Non collegato', true);
    teacherDebugPhaseBadge.textContent = '-';
    teacherDebugQuestionBadge.textContent = '-';
    teacherDebugLastUpdate.textContent = message;
    teacherDebugQuestionTitle.textContent = 'In attesa del quiz';
    teacherDebugQuestionCounter.textContent = '-';
    teacherDebugQuestionPrompt.textContent = 'Apri il quiz studente con il server locale attivo.';
    teacherDebugStatePill.textContent = 'LETTURA';
    teacherDebugCameraState.textContent = '-';
    teacherDebugCameraFeedStatus.textContent = 'In attesa del feed webcam';
    teacherDebugCommandState.textContent = '-';
    teacherDebugMachineState.textContent = '-';
    teacherDebugFaceDetected.textContent = 'No';
    teacherDebugProfileStatus.textContent = '-';
    teacherDebugEarProfile.textContent = 'Soglia EAR non disponibile.';
    teacherDebugMarProfile.textContent = 'Soglia MAR non disponibile.';
    teacherDebugGlassesProfile.textContent = 'Modalita occhiali non disponibile.';
    teacherDebugLeftEar.textContent = '0.000';
    teacherDebugRightEar.textContent = '0.000';
    teacherDebugAverageEar.textContent = '0.000';
    teacherDebugMar.textContent = '0.000';
    teacherDebugEarThreshold.textContent = '0.000';
    teacherDebugRightEarThreshold.textContent = '0.000';
    teacherDebugMarThreshold.textContent = '0.000';
    setSensorCard(teacherDebugLeftEyeCard, teacherDebugLeftEyeStatus, null);
    setSensorCard(teacherDebugRightEyeCard, teacherDebugRightEyeStatus, null);
    setSensorCard(teacherDebugMouthCard, teacherDebugMouthStatus, null);
    setFrame(teacherDebugTrackingFrame, teacherDebugTrackingEmpty, null);
    setFrame(teacherDebugZoomFrame, teacherDebugZoomEmpty, null);
    renderEvents([]);
}

function renderSnapshot(snapshot) {
    const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
    const isFresh = updatedAt && (Date.now() - updatedAt.getTime()) < 5000;
    const thresholds = snapshot.thresholds || {};

    setConnectionStatus(isFresh ? 'Collegato' : 'Segnale debole', !isFresh);
    teacherDebugPhaseBadge.textContent = snapshot.phaseLabel || '-';
    teacherDebugQuestionBadge.textContent = snapshot.questionCounterLabel || '-';
    teacherDebugLastUpdate.textContent = updatedAt
        ? `Ultimo aggiornamento: ${updatedAt.toLocaleTimeString('it-IT')}`
        : 'Nessun dato ricevuto';

    teacherDebugStatePill.textContent = (snapshot.phaseLabel || 'LETTURA').toUpperCase();
    teacherDebugCameraState.textContent = snapshot.cameraState || '-';
    teacherDebugCameraFeedStatus.textContent = snapshot.frames && snapshot.frames.tracking
        ? 'Feed webcam remoto attivo'
        : 'Tracking senza frame live disponibili';
    teacherDebugCommandState.textContent = snapshot.commandLabel || '-';
    teacherDebugMachineState.textContent = snapshot.currentState || '-';
    teacherDebugFaceDetected.textContent = snapshot.faceDetected ? 'Si' : 'No';

    if (snapshot.currentQuestion) {
        teacherDebugQuestionTitle.textContent = snapshot.currentQuestion.title;
        teacherDebugQuestionPrompt.textContent = snapshot.currentQuestion.prompt;
    } else if (snapshot.simulationCompleted) {
        teacherDebugQuestionTitle.textContent = 'Test completato';
        teacherDebugQuestionPrompt.textContent = 'Il ragazzo ha concluso il quiz attuale.';
    } else {
        teacherDebugQuestionTitle.textContent = 'Quiz non ancora pronto';
        teacherDebugQuestionPrompt.textContent = 'In attesa di una domanda attiva dal PC.';
    }

    teacherDebugQuestionCounter.textContent = snapshot.questionCounterLabel || '-';
    teacherDebugLeftEar.textContent = formatMetric(snapshot.metrics && snapshot.metrics.leftEar);
    teacherDebugRightEar.textContent = formatMetric(snapshot.metrics && snapshot.metrics.rightEar);
    teacherDebugAverageEar.textContent = formatMetric(snapshot.metrics && snapshot.metrics.averageEar);
    teacherDebugMar.textContent = formatMetric(snapshot.metrics && snapshot.metrics.mar);
    teacherDebugEarThreshold.textContent = formatMetric(thresholds.ear);
    teacherDebugRightEarThreshold.textContent = formatMetric(thresholds.ear);
    teacherDebugMarThreshold.textContent = formatMetric(thresholds.mar);

    teacherDebugProfileStatus.textContent = thresholds.glassesMode ? 'Modalita occhiali attiva' : 'Profilo standard';
    teacherDebugEarProfile.textContent = `EAR intenzionale sotto ${formatMetric(thresholds.ear)}.`;
    teacherDebugMarProfile.textContent = `Scroll bocca sopra ${formatMetric(thresholds.mar)}.`;
    teacherDebugGlassesProfile.textContent = thresholds.glassesMode
        ? 'Smoothing e taratura per utilizzo con occhiali.'
        : 'Nessuna compensazione dedicata per occhiali.';

    setSensorCard(teacherDebugLeftEyeCard, teacherDebugLeftEyeStatus, snapshot.sensors && snapshot.sensors.leftEye);
    setSensorCard(teacherDebugRightEyeCard, teacherDebugRightEyeStatus, snapshot.sensors && snapshot.sensors.rightEye);
    setSensorCard(teacherDebugMouthCard, teacherDebugMouthStatus, snapshot.sensors && snapshot.sensors.mouth);
    setFrame(teacherDebugTrackingFrame, teacherDebugTrackingEmpty, snapshot.frames && snapshot.frames.tracking);
    setFrame(teacherDebugZoomFrame, teacherDebugZoomEmpty, snapshot.frames && snapshot.frames.zoom);
    renderEvents(snapshot.events);
}

async function refreshSnapshot() {
    try {
        const response = await fetchJson('/api/student-state');
        if (!response.snapshot) {
            renderDisconnectedState('Il PC non ha ancora inviato uno stato.');
            return;
        }

        renderSnapshot(response.snapshot);
    } catch (error) {
        renderDisconnectedState('Server o quiz non raggiungibile.');
    }
}

window.addEventListener('beforeunload', () => {
    if (snapshotTimer) {
        window.clearInterval(snapshotTimer);
    }
});

renderDisconnectedState('Connessione iniziale in corso...');
void refreshSnapshot();
snapshotTimer = window.setInterval(() => {
    void refreshSnapshot();
}, SNAPSHOT_REFRESH_MS);
