const DEBUG_CHANNEL_NAME = 'ric-facc-student-debug';
const DEBUG_STORAGE_KEY = 'ricFaccDebugSnapshot';
const REQUEST_SYNC_MS = 1400;

const debugConnectionStatus = document.getElementById('debugConnectionStatus');
const debugPhaseBadge = document.getElementById('debugPhaseBadge');
const debugQuestionBadge = document.getElementById('debugQuestionBadge');
const debugCameraState = document.getElementById('debugCameraState');
const debugStatePill = document.getElementById('debugStatePill');
const debugQuestionTitle = document.getElementById('debugQuestionTitle');
const debugQuestionCounter = document.getElementById('debugQuestionCounter');
const debugQuestionPrompt = document.getElementById('debugQuestionPrompt');
const debugMachineState = document.getElementById('debugMachineState');
const debugLastUpdate = document.getElementById('debugLastUpdate');
const debugCommandState = document.getElementById('debugCommandState');
const debugFaceDetected = document.getElementById('debugFaceDetected');
const debugAverageEar = document.getElementById('debugAverageEar');
const debugMarLive = document.getElementById('debugMarLive');
const debugThresholdSummary = document.getElementById('debugThresholdSummary');
const debugEarProfile = document.getElementById('debugEarProfile');
const debugMarProfile = document.getElementById('debugMarProfile');
const debugGlassesProfile = document.getElementById('debugGlassesProfile');
const debugRemoteStatus = document.getElementById('debugRemoteStatus');
const debugTeacherUrl = document.getElementById('debugTeacherUrl');
const debugEventLog = document.getElementById('debugEventLog');
const debugActionStatus = document.getElementById('debugActionStatus');

const debugTrackingFrame = document.getElementById('debugTrackingFrame');
const debugTrackingEmpty = document.getElementById('debugTrackingEmpty');
const debugZoomFrame = document.getElementById('debugZoomFrame');
const debugZoomEmpty = document.getElementById('debugZoomEmpty');

const debugLeftEyeCard = document.getElementById('debugLeftEyeCard');
const debugLeftEyeStatus = document.getElementById('debugLeftEyeStatus');
const debugLeftEyeValue = document.getElementById('debugLeftEyeValue');
const debugRightEyeCard = document.getElementById('debugRightEyeCard');
const debugRightEyeStatus = document.getElementById('debugRightEyeStatus');
const debugRightEyeValue = document.getElementById('debugRightEyeValue');
const debugMouthCard = document.getElementById('debugMouthCard');
const debugMouthStatus = document.getElementById('debugMouthStatus');
const debugMouthValue = document.getElementById('debugMouthValue');

const actionButtons = {
    'start-camera': document.getElementById('debugStartCameraBtn'),
    'read-question': document.getElementById('debugReadQuestionBtn'),
    'simulate-scroll': document.getElementById('debugSimulateScrollBtn'),
    'simulate-select': document.getElementById('debugSimulateSelectBtn'),
    'simulate-confirm': document.getElementById('debugSimulateConfirmBtn'),
    'run-demo': document.getElementById('debugRunDemoBtn'),
    'reset-flow': document.getElementById('debugResetBtn')
};

let debugChannel = null;
let syncTimer = null;
let lastSnapshotAt = 0;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setActionStatus(message, isError = false) {
    debugActionStatus.textContent = message;
    debugActionStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function formatMetric(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(3) : '0.000';
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

function setSensorState(cardElement, statusElement, valueElement, sensor) {
    if (!sensor) {
        cardElement.classList.remove('state-open', 'state-closed');
        statusElement.textContent = 'ATTESA';
        valueElement.textContent = '0.000';
        return;
    }

    const numericValue = sensor && typeof sensor.value !== 'undefined' ? Number(sensor.value) : 0;
    const isOpen = Boolean(sensor && sensor.isOpen);
    cardElement.classList.remove('state-open', 'state-closed');
    cardElement.classList.add(isOpen ? 'state-open' : 'state-closed');
    statusElement.textContent = sensor && sensor.status ? sensor.status : 'ATTESA';
    valueElement.textContent = formatMetric(numericValue);
}

function renderEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
        debugEventLog.innerHTML = '<li><span class="log-time">--:--:--</span><span class="log-text">Nessun evento disponibile.</span></li>';
        return;
    }

    debugEventLog.innerHTML = events.map((eventItem) => `
        <li>
            <span class="log-time">${escapeHtml(eventItem.time || '--:--:--')}</span>
            <span class="log-text">${escapeHtml(eventItem.message || '')}</span>
        </li>
    `).join('');
}

function renderSnapshot(snapshot) {
    if (!snapshot) {
        return;
    }

    lastSnapshotAt = Date.now();
    debugConnectionStatus.textContent = 'Collegato';
    debugConnectionStatus.style.color = 'var(--text)';

    debugPhaseBadge.textContent = snapshot.phaseLabel || '-';
    debugQuestionBadge.textContent = snapshot.questionCounterLabel || '-';
    debugCameraState.textContent = snapshot.cameraState || 'Webcam non avviata';
    debugStatePill.textContent = (snapshot.phaseLabel || 'LETTURA').toUpperCase();
    debugQuestionCounter.textContent = snapshot.questionCounterLabel || '-';
    debugMachineState.textContent = snapshot.currentState || '-';
    debugCommandState.textContent = snapshot.commandLabel || 'In attesa';
    debugFaceDetected.textContent = snapshot.faceDetected ? 'Si' : 'No';
    debugAverageEar.textContent = formatMetric(snapshot.metrics && snapshot.metrics.averageEar);
    debugMarLive.textContent = formatMetric(snapshot.metrics && snapshot.metrics.mar);

    const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
    debugLastUpdate.textContent = updatedAt
        ? updatedAt.toLocaleTimeString('it-IT')
        : '-';

    if (snapshot.currentQuestion) {
        debugQuestionTitle.textContent = snapshot.currentQuestion.title;
        debugQuestionPrompt.textContent = snapshot.currentQuestion.prompt;
    } else if (snapshot.simulationCompleted) {
        debugQuestionTitle.textContent = 'Test completato';
        debugQuestionPrompt.textContent = 'La sessione quiz e terminata.';
    } else {
        debugQuestionTitle.textContent = 'In attesa del quiz';
        debugQuestionPrompt.textContent = 'Apri la sessione quiz principale per vedere i dati live.';
    }

    const thresholds = snapshot.thresholds || {};
    debugThresholdSummary.textContent = `EAR ${formatMetric(thresholds.ear)} / MAR ${formatMetric(thresholds.mar)}`;
    debugEarProfile.textContent = `Chiusura occhi intenzionale sotto EAR ${formatMetric(thresholds.ear)}`;
    debugMarProfile.textContent = `Scroll con bocca sopra MAR ${formatMetric(thresholds.mar)}`;
    debugGlassesProfile.textContent = thresholds.glassesMode
        ? 'Smoothing e soglie ottimizzate per utilizzo con occhiali'
        : 'Profilo senza compensazione dedicata per occhiali';

    const remote = snapshot.remote || {};
    debugRemoteStatus.textContent = remote.status || 'In attesa';
    debugTeacherUrl.textContent = remote.teacherUrl || 'Pannello docente non ancora disponibile.';

    setSensorState(debugLeftEyeCard, debugLeftEyeStatus, debugLeftEyeValue, snapshot.sensors && snapshot.sensors.leftEye);
    setSensorState(debugRightEyeCard, debugRightEyeStatus, debugRightEyeValue, snapshot.sensors && snapshot.sensors.rightEye);
    setSensorState(debugMouthCard, debugMouthStatus, debugMouthValue, snapshot.sensors && snapshot.sensors.mouth);

    if (snapshot.frames) {
        setFrame(debugTrackingFrame, debugTrackingEmpty, snapshot.frames.tracking);
        setFrame(debugZoomFrame, debugZoomEmpty, snapshot.frames.zoom);
    }

    renderEvents(snapshot.events);
}

function renderStaleState() {
    const isFresh = (Date.now() - lastSnapshotAt) < 4500;
    if (isFresh) {
        return;
    }
    debugConnectionStatus.textContent = 'Segnale debole';
    debugConnectionStatus.style.color = 'var(--red)';
}

function requestSync() {
    if (!debugChannel) {
        return;
    }
    debugChannel.postMessage({ type: 'debug-request-sync' });
}

function sendAction(action) {
    if (!debugChannel) {
        setActionStatus('BroadcastChannel non disponibile in questo browser.', true);
        return;
    }

    debugChannel.postMessage({
        type: 'debug-action',
        action
    });
    setActionStatus('Comando inviato al quiz');
}

function loadStoredSnapshot() {
    try {
        const rawSnapshot = localStorage.getItem(DEBUG_STORAGE_KEY);
        if (!rawSnapshot) {
            return;
        }
        renderSnapshot(JSON.parse(rawSnapshot));
    } catch (error) {
        setActionStatus('Impossibile leggere lo stato locale del debug.', true);
    }
}

Object.entries(actionButtons).forEach(([action, button]) => {
    button.addEventListener('click', () => {
        sendAction(action);
    });
});

if ('BroadcastChannel' in window) {
    debugChannel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
    debugChannel.addEventListener('message', (event) => {
        const payload = event.data || {};
        if (payload.type === 'student-debug-snapshot' && payload.snapshot) {
            renderSnapshot(payload.snapshot);
        }
    });
    requestSync();
    syncTimer = window.setInterval(() => {
        requestSync();
        renderStaleState();
    }, REQUEST_SYNC_MS);
} else {
    debugConnectionStatus.textContent = 'Non supportato';
    debugConnectionStatus.style.color = 'var(--red)';
    setActionStatus('Il browser non supporta BroadcastChannel.', true);
}

window.addEventListener('beforeunload', () => {
    if (syncTimer) {
        window.clearInterval(syncTimer);
    }
    if (debugChannel) {
        debugChannel.close();
    }
});

renderEvents([]);
loadStoredSnapshot();
