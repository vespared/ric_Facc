const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const SNAPSHOT_REFRESH_MS = 1200;

const teacherConnectionStatus = document.getElementById('teacherConnectionStatus');
const teacherPhaseBadge = document.getElementById('teacherPhaseBadge');
const teacherQuestionBadge = document.getElementById('teacherQuestionBadge');
const teacherCommandDeliveryStatus = document.getElementById('teacherCommandDeliveryStatus');
const teacherLastUpdate = document.getElementById('teacherLastUpdate');
const teacherActionStatus = document.getElementById('teacherActionStatus');

const studentCameraStatus = document.getElementById('studentCameraStatus');
const studentCommandStatus = document.getElementById('studentCommandStatus');
const studentStateStatus = document.getElementById('studentStateStatus');
const studentCounterStatus = document.getElementById('studentCounterStatus');

const teacherQuestionTitle = document.getElementById('teacherQuestionTitle');
const teacherQuestionPrompt = document.getElementById('teacherQuestionPrompt');
const teacherChoiceList = document.getElementById('teacherChoiceList');
const teacherEventLog = document.getElementById('teacherEventLog');

const teacherLeftEar = document.getElementById('teacherLeftEar');
const teacherRightEar = document.getElementById('teacherRightEar');
const teacherAverageEar = document.getElementById('teacherAverageEar');
const teacherMar = document.getElementById('teacherMar');

const teacherStartExamBtn = document.getElementById('teacherStartExamBtn');
const teacherStartCameraBtn = document.getElementById('teacherStartCameraBtn');
const teacherReadQuestionBtn = document.getElementById('teacherReadQuestionBtn');
const teacherScrollBtn = document.getElementById('teacherScrollBtn');
const teacherSelectBtn = document.getElementById('teacherSelectBtn');
const teacherConfirmBtn = document.getElementById('teacherConfirmBtn');
const teacherRepeatQuestionBtn = document.getElementById('teacherRepeatQuestionBtn');
const teacherNextQuestionBtn = document.getElementById('teacherNextQuestionBtn');
const teacherResetBtn = document.getElementById('teacherResetBtn');
const teacherFinishExamBtn = document.getElementById('teacherFinishExamBtn');
const teacherFramingBtn = document.getElementById('teacherFramingBtn');
const teacherFramingCard = document.getElementById('teacherFramingCard');
const teacherFramingStatus = document.getElementById('teacherFramingStatus');
const teacherFramingMessage = document.getElementById('teacherFramingMessage');
const teacherFramingScene = document.getElementById('teacherFramingScene');
const framingFaceGroup = document.getElementById('framingFaceGroup');
const framingFaceBox = document.getElementById('framingFaceBox');
const framingNoFaceLabel = document.getElementById('framingNoFaceLabel');
const framingLeftEyeMarker = document.getElementById('framingLeftEyeMarker');
const framingRightEyeMarker = document.getElementById('framingRightEyeMarker');
const framingMouthMarker = document.getElementById('framingMouthMarker');
const framingBadgeFace = document.getElementById('framingBadgeFace');
const framingBadgeLeftEye = document.getElementById('framingBadgeLeftEye');
const framingBadgeRightEye = document.getElementById('framingBadgeRightEye');
const framingBadgeMouth = document.getElementById('framingBadgeMouth');

const FRAMING_SCENE_WIDTH = 200;
const FRAMING_SCENE_HEIGHT = 150;
let framingVisible = false;
const PRESENTATION_FILE = 'Presentazione.mp4';
const teacherPresentationStatus = document.getElementById('teacherPresentationStatus');
const teacherOpenPresentationBtn = document.getElementById('teacherOpenPresentationBtn');
const teacherClosePresentationBtn = document.getElementById('teacherClosePresentationBtn');
const teacherVideoControls = document.getElementById('teacherVideoControls');
const teacherVideoPlayBtn = document.getElementById('teacherVideoPlayBtn');
const teacherVideoPauseBtn = document.getElementById('teacherVideoPauseBtn');
const teacherVideoBackBtn = document.getElementById('teacherVideoBackBtn');
const teacherVideoForwardBtn = document.getElementById('teacherVideoForwardBtn');
const teacherVideoRestartBtn = document.getElementById('teacherVideoRestartBtn');

const teacherPublishNowBtn = document.getElementById('teacherPublishNowBtn');
const teacherQueueNextBtn = document.getElementById('teacherQueueNextBtn');

const teacherQuestionTitleInput = document.getElementById('teacherQuestionTitleInput');
const teacherQuestionPromptInput = document.getElementById('teacherQuestionPromptInput');
const teacherOptionAInput = document.getElementById('teacherOptionAInput');
const teacherOptionBInput = document.getElementById('teacherOptionBInput');
const teacherOptionCInput = document.getElementById('teacherOptionCInput');
const teacherOptionDInput = document.getElementById('teacherOptionDInput');
const teacherCorrectAnswerInput = document.getElementById('teacherCorrectAnswerInput');

let snapshotTimer = null;
let lastSentCommandId = 0;

function getCommandLabel(type) {
    switch (type) {
        case 'start-exam':
            return 'Inizia esame';
        case 'start-camera':
            return 'Avvia webcam';
        case 'read-question':
            return 'Leggi domanda';
        case 'simulate-scroll':
            return 'Scroll risposta';
        case 'simulate-select':
            return 'Seleziona / Annulla';
        case 'simulate-confirm':
            return 'Conferma risposta';
        case 'reset-flow':
            return 'Resetta quiz';
        case 'publish-now':
            return 'Pubblica subito';
        case 'queue-next':
            return 'Aggiungi come prossima';
        case 'publish-batch':
            return 'Pubblica file subito';
        case 'queue-batch':
            return 'Aggiungi file in coda';
        case 'switch-to-presentation':
            return 'Apri video';
        case 'close-presentation':
            return 'Chiudi video';
        case 'video-play':
            return 'Play video';
        case 'video-pause':
            return 'Pausa video';
        case 'video-restart':
            return 'Ricomincia video';
        case 'video-skip-forward':
            return 'Avanti 10s';
        case 'video-skip-backward':
            return 'Indietro 10s';
        case 'repeat-question':
            return 'Ripeti domanda';
        case 'next-question':
            return 'Domanda successiva';
        case 'finish-exam':
            return 'Termina esame';
        default:
            return type || 'Comando remoto';
    }
}

function resolveCorrectIndex(value, options, questionIndex) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value >= 0 && value < options.length) {
            return value;
        }
        if (value >= 1 && value <= options.length) {
            return value - 1;
        }
    }

    const normalized = String(value || '').trim();
    const upper = normalized.toUpperCase();
    const numeric = Number.parseInt(normalized, 10);

    if (OPTION_LETTERS.includes(upper)) {
        return OPTION_LETTERS.indexOf(upper);
    }

    if (!Number.isNaN(numeric)) {
        if (numeric >= 1 && numeric <= options.length) {
            return numeric - 1;
        }
        if (numeric >= 0 && numeric < options.length) {
            return numeric;
        }
    }

    const matchedByText = options.findIndex((option) => option.toLowerCase() === normalized.toLowerCase());
    if (matchedByText >= 0) {
        return matchedByText;
    }

    throw new Error(`Domanda ${questionIndex + 1}: risposta corretta non valida.`);
}

function normalizeQuestion(rawQuestion, index) {
    const title = String(rawQuestion.title || `Domanda ${index + 1}`).trim();
    const prompt = String(rawQuestion.prompt || rawQuestion.question || rawQuestion.domanda || '').trim();
    const options = Array.isArray(rawQuestion.options)
        ? rawQuestion.options.map((option) => String(option || '').trim())
        : [rawQuestion.optionA || rawQuestion.a, rawQuestion.optionB || rawQuestion.b, rawQuestion.optionC || rawQuestion.c, rawQuestion.optionD || rawQuestion.d]
            .map((option) => String(option || '').trim());

    // Scarta le opzioni vuote in coda: cosi sono ammesse le domande con sole 2 risposte
    // (C e D assenti) oltre a quelle classiche con 4 opzioni.
    while (options.length > 0 && !options[options.length - 1]) {
        options.pop();
    }

    if (!prompt) {
        throw new Error(`Domanda ${index + 1}: testo domanda mancante.`);
    }

    if (options.length < 2 || options.length > 4 || options.some((option) => !option)) {
        throw new Error(`Domanda ${index + 1}: servono da 2 a 4 opzioni compilate.`);
    }

    return {
        title,
        prompt,
        options,
        correctIndex: resolveCorrectIndex(
            rawQuestion.correctIndex ?? rawQuestion.correct ?? rawQuestion.corretta ?? rawQuestion.answer ?? rawQuestion.risposta,
            options,
            index
        )
    };
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getFetchFailureMessage() {
    if (window.location.protocol === 'file:') {
        return 'Apri il pannello docente da http://localhost:3000/teacher.html oppure dall IP del PC, non come file locale.';
    }

    return 'Server docente non raggiungibile. Verifica che `node server.js` sia attivo e che questa pagina sia aperta da /teacher.html sulla stessa rete del PC.';
}

async function fetchJson(path, options = {}) {
    let response;
    try {
        response = await fetch(path, {
            ...options,
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
    } catch (error) {
        throw new Error(getFetchFailureMessage());
    }

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(payload.error || `Richiesta non riuscita (${response.status}).`);
    }

    return payload;
}

function setConnectionStatus(message, isError = false) {
    teacherConnectionStatus.textContent = message;
    teacherConnectionStatus.style.color = isError ? 'var(--red)' : 'var(--text)';
}

function setActionStatus(message, isError = false) {
    teacherActionStatus.textContent = message;
    teacherActionStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function setCommandDeliveryStatus(message, tone = 'muted') {
    if (!teacherCommandDeliveryStatus) {
        return;
    }

    teacherCommandDeliveryStatus.textContent = message;
    if (tone === 'error') {
        teacherCommandDeliveryStatus.style.color = 'var(--red)';
        return;
    }
    if (tone === 'success') {
        teacherCommandDeliveryStatus.style.color = 'var(--green)';
        return;
    }

    teacherCommandDeliveryStatus.style.color = 'var(--text)';
}

function setMetric(element, value) {
    if (!element) {
        return;
    }
    const numericValue = Number(value);
    element.textContent = Number.isFinite(numericValue) ? numericValue.toFixed(3) : '0.000';
}

function getChoiceTag(snapshot, index) {
    if (snapshot.answerLockedIndex === index) {
        return 'Registrata';
    }
    if (snapshot.selectedIndex === index) {
        return 'Scelta';
    }
    if (snapshot.focusedIndex === index) {
        return 'Focus';
    }
    if (snapshot.currentQuestion && snapshot.currentQuestion.correctIndex === index) {
        return 'Corretta';
    }
    return 'Opzione';
}

function renderChoices(snapshot) {
    const question = snapshot.currentQuestion;
    if (!question) {
        teacherChoiceList.innerHTML = '';
        return;
    }

    teacherChoiceList.innerHTML = question.options.map((option, index) => {
        const classes = ['teacher-choice-item'];
        if (snapshot.focusedIndex === index) {
            classes.push('is-current-focus');
        }
        if (snapshot.selectedIndex === index) {
            classes.push('is-selected');
        }
        if (snapshot.answerLockedIndex === index) {
            classes.push('is-locked');
        }
        if (question.correctIndex === index) {
            classes.push('is-correct-answer');
        }

        return `
            <article class="${classes.join(' ')}">
                <div class="teacher-choice-head">
                    <span class="teacher-choice-letter">${OPTION_LETTERS[index]}</span>
                    <span class="teacher-choice-tag">${getChoiceTag(snapshot, index)}</span>
                </div>
                <p class="teacher-choice-text">${escapeHtml(option)}</p>
            </article>
        `;
    }).join('');
}

function renderEvents(snapshot) {
    if (!teacherEventLog) {
        return;
    }
    const events = Array.isArray(snapshot.events) ? snapshot.events : [];
    if (events.length === 0) {
        teacherEventLog.innerHTML = '<li><span class="log-time">--:--:--</span><span class="log-text">Nessun evento disponibile.</span></li>';
        return;
    }

    teacherEventLog.innerHTML = events.map((eventItem) => `
        <li>
            <span class="log-time">${escapeHtml(eventItem.time || '--:--:--')}</span>
            <span class="log-text">${escapeHtml(eventItem.message || '')}</span>
        </li>
    `).join('');
}

function renderCommandAck(commandAck) {
    if (!commandAck || !commandAck.id) {
        setCommandDeliveryStatus('Nessuna conferma ancora ricevuta');
        return;
    }

    const when = commandAck.ackedAt
        ? new Date(commandAck.ackedAt).toLocaleTimeString('it-IT')
        : '--:--:--';
    const label = getCommandLabel(commandAck.type);

    if (commandAck.status === 'error') {
        setCommandDeliveryStatus(`${label}: errore sul PC alle ${when}. ${commandAck.message || ''}`.trim(), 'error');
        return;
    }

    setCommandDeliveryStatus(`${label}: eseguito sul PC alle ${when}`, 'success');
}

function setBadgeState(element, label, state) {
    if (!element) {
        return;
    }
    element.classList.remove('is-ok', 'is-warning', 'is-error', 'is-idle');
    const stateClass = state.tone === 'ok' ? 'is-ok'
        : state.tone === 'warning' ? 'is-warning'
            : state.tone === 'error' ? 'is-error'
                : 'is-idle';
    element.classList.add(stateClass);
    const stateLabel = element.querySelector('.framing-badge-state');
    if (stateLabel) {
        stateLabel.textContent = state.text;
    }
    const labelEl = element.querySelector('.framing-badge-label');
    if (labelEl) {
        labelEl.textContent = label;
    }
}

function setMarkerState(markerEl, tone, visible, cx, cy) {
    if (!markerEl) {
        return;
    }
    markerEl.classList.remove('is-ok', 'is-warning', 'is-error', 'is-missing');
    if (!visible) {
        markerEl.setAttribute('opacity', '0');
        return;
    }
    markerEl.setAttribute('opacity', '1');
    const stateClass = tone === 'ok' ? 'is-ok'
        : tone === 'warning' ? 'is-warning'
            : tone === 'error' ? 'is-error'
                : 'is-missing';
    markerEl.classList.add(stateClass);
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
        markerEl.setAttribute('transform', `translate(${cx.toFixed(2)}, ${cy.toFixed(2)})`);
    }
}

function featureState(feature, cameraRunning) {
    if (!cameraRunning) {
        return { tone: 'idle', text: 'Webcam non attiva' };
    }
    if (!feature || !feature.present) {
        return { tone: 'error', text: 'Non rilevato' };
    }
    if (!feature.withinFrame) {
        return { tone: 'error', text: 'Fuori inquadratura' };
    }
    return { tone: 'ok', text: 'Inquadrato correttamente' };
}

function renderFramingMarker(markerEl, feature, cameraRunning) {
    if (!markerEl) {
        return;
    }
    if (!cameraRunning || !feature || !feature.present || !feature.center) {
        setMarkerState(markerEl, 'missing', false);
        return;
    }
    const cx = feature.center.x * FRAMING_SCENE_WIDTH;
    const cy = feature.center.y * FRAMING_SCENE_HEIGHT;
    const tone = feature.withinFrame ? 'ok' : 'error';
    setMarkerState(markerEl, tone, true, cx, cy);
}

function renderFramingFaceBox(framing) {
    if (!framingFaceGroup || !framingFaceBox) {
        return;
    }
    if (!framing || !framing.cameraRunning || !framing.faceDetected || !framing.faceBox) {
        framingFaceGroup.setAttribute('opacity', '0');
        return;
    }
    const minX = framing.faceBox.minX * FRAMING_SCENE_WIDTH;
    const minY = framing.faceBox.minY * FRAMING_SCENE_HEIGHT;
    const width = Math.max(2, (framing.faceBox.maxX - framing.faceBox.minX) * FRAMING_SCENE_WIDTH);
    const height = Math.max(2, (framing.faceBox.maxY - framing.faceBox.minY) * FRAMING_SCENE_HEIGHT);
    framingFaceBox.setAttribute('x', minX.toFixed(2));
    framingFaceBox.setAttribute('y', minY.toFixed(2));
    framingFaceBox.setAttribute('width', width.toFixed(2));
    framingFaceBox.setAttribute('height', height.toFixed(2));
    framingFaceGroup.classList.remove('is-ok', 'is-warning', 'is-error');
    const tone = framing.overall === 'ok' ? 'is-ok'
        : framing.overall === 'warning' ? 'is-warning'
            : 'is-error';
    framingFaceGroup.classList.add(tone);
    framingFaceGroup.setAttribute('opacity', '1');
}

function renderFraming(framing) {
    if (!teacherFramingCard) {
        return;
    }

    if (!framing) {
        framing = {
            cameraRunning: false,
            faceDetected: false,
            features: {
                leftEye: { present: false, withinFrame: false, center: null },
                rightEye: { present: false, withinFrame: false, center: null },
                mouth: { present: false, withinFrame: false, center: null }
            },
            overall: 'inactive',
            message: 'Dati di inquadratura non ricevuti.'
        };
    }

    const cameraRunning = Boolean(framing.cameraRunning);
    const features = framing.features || {};
    const leftEye = features.leftEye;
    const rightEye = features.rightEye;
    const mouth = features.mouth;

    const overallText = !cameraRunning
        ? 'Webcam spenta'
        : framing.overall === 'ok' ? 'Inquadratura corretta'
            : framing.overall === 'warning' ? 'Attenzione: regola la posizione'
                : framing.overall === 'no-face' ? 'Volto non rilevato'
                    : 'Inquadratura da correggere';

    if (teacherFramingStatus) {
        teacherFramingStatus.textContent = overallText;
        teacherFramingStatus.style.color = framing.overall === 'ok'
            ? 'var(--green)'
            : framing.overall === 'warning'
                ? 'var(--accent, #ffd166)'
                : !cameraRunning
                    ? 'var(--muted)'
                    : 'var(--red)';
    }
    if (teacherFramingMessage) {
        teacherFramingMessage.textContent = framing.message || overallText;
    }

    teacherFramingCard.classList.remove('is-ok', 'is-warning', 'is-error', 'is-inactive');
    const cardTone = !cameraRunning ? 'is-inactive'
        : framing.overall === 'ok' ? 'is-ok'
            : framing.overall === 'warning' ? 'is-warning'
                : 'is-error';
    teacherFramingCard.classList.add(cardTone);

    if (framingNoFaceLabel) {
        framingNoFaceLabel.setAttribute('opacity', cameraRunning && !framing.faceDetected ? '1' : '0');
    }

    renderFramingFaceBox(framing);
    renderFramingMarker(framingLeftEyeMarker, leftEye, cameraRunning);
    renderFramingMarker(framingRightEyeMarker, rightEye, cameraRunning);
    renderFramingMarker(framingMouthMarker, mouth, cameraRunning);

    setBadgeState(framingBadgeFace, 'Volto', !cameraRunning
        ? { tone: 'idle', text: 'Webcam non attiva' }
        : framing.faceDetected
            ? { tone: 'ok', text: 'Rilevato' }
            : { tone: 'error', text: 'Non rilevato' }
    );
    setBadgeState(framingBadgeLeftEye, 'Occhio sinistro', featureState(leftEye, cameraRunning && framing.faceDetected));
    setBadgeState(framingBadgeRightEye, 'Occhio destro', featureState(rightEye, cameraRunning && framing.faceDetected));
    setBadgeState(framingBadgeMouth, 'Bocca', featureState(mouth, cameraRunning && framing.faceDetected));
}

function setFramingVisible(visible) {
    framingVisible = Boolean(visible);
    if (teacherFramingCard) {
        teacherFramingCard.hidden = !framingVisible;
    }
    if (teacherFramingBtn) {
        teacherFramingBtn.classList.toggle('is-active', framingVisible);
        teacherFramingBtn.textContent = framingVisible
            ? 'Nascondi verifica inquadratura'
            : 'Verifica inquadratura webcam';
    }
    if (framingVisible && teacherFramingCard) {
        teacherFramingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function renderSnapshot(snapshot, commandAck = null) {
    const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
    const isFresh = updatedAt && (Date.now() - updatedAt.getTime()) < 5000;

    setConnectionStatus(isFresh ? 'Collegato in tempo reale' : 'Segnale debole o fermo', !isFresh);
    teacherPhaseBadge.textContent = snapshot.phaseLabel || '-';
    teacherQuestionBadge.textContent = snapshot.questionCounterLabel || '-';
    teacherLastUpdate.textContent = updatedAt
        ? `Ultimo aggiornamento: ${updatedAt.toLocaleTimeString('it-IT')}`
        : 'Nessun dato ricevuto';
    renderCommandAck(commandAck);

    if (lastSentCommandId > 0) {
        if (commandAck && commandAck.id >= lastSentCommandId) {
            setActionStatus(
                commandAck.status === 'error'
                    ? `Ultimo comando fallito sul PC: ${commandAck.message || 'errore remoto'}`
                    : 'Ultimo comando eseguito dal PC',
                commandAck.status === 'error'
            );
        } else {
            setActionStatus('Comando inviato al server, in attesa del PC...');
        }
    }

    studentCameraStatus.textContent = snapshot.cameraState || '-';
    studentCommandStatus.textContent = snapshot.commandLabel || '-';
    studentStateStatus.textContent = snapshot.currentState || '-';
    studentCounterStatus.textContent = snapshot.questionCounterLabel || '-';

    if (snapshot.currentQuestion) {
        teacherQuestionTitle.textContent = snapshot.currentQuestion.title;
        teacherQuestionPrompt.textContent = snapshot.currentQuestion.prompt;
    } else if (snapshot.simulationCompleted) {
        teacherQuestionTitle.textContent = 'Test completato';
        teacherQuestionPrompt.textContent = 'Il ragazzo ha concluso il quiz attuale.';
    } else {
        teacherQuestionTitle.textContent = 'Quiz non ancora pronto';
        teacherQuestionPrompt.textContent = 'In attesa di una domanda attiva dal PC.';
    }

    setMetric(teacherLeftEar, snapshot.metrics && snapshot.metrics.leftEar);
    setMetric(teacherRightEar, snapshot.metrics && snapshot.metrics.rightEar);
    setMetric(teacherAverageEar, snapshot.metrics && snapshot.metrics.averageEar);
    setMetric(teacherMar, snapshot.metrics && snapshot.metrics.mar);

    renderChoices(snapshot);
    renderEvents(snapshot);
    renderFraming(snapshot.framing || null);
    processExamFlow(snapshot);
}

function renderDisconnectedState(message) {
    setConnectionStatus('Non collegato', true);
    teacherPhaseBadge.textContent = '-';
    teacherQuestionBadge.textContent = '-';
    setCommandDeliveryStatus('Nessuna conferma dal PC', 'error');
    teacherLastUpdate.textContent = message;
    studentCameraStatus.textContent = '-';
    studentCommandStatus.textContent = '-';
    studentStateStatus.textContent = '-';
    studentCounterStatus.textContent = '-';
    teacherQuestionTitle.textContent = 'In attesa del quiz sul PC';
    teacherQuestionPrompt.textContent = 'Apri il quiz del ragazzo con il server locale attivo e mantieni questa pagina sulla stessa rete.';
    teacherChoiceList.innerHTML = '';
    if (teacherEventLog) {
        teacherEventLog.innerHTML = '<li><span class="log-time">--:--:--</span><span class="log-text">Nessun evento disponibile.</span></li>';
    }
    setMetric(teacherLeftEar, 0);
    setMetric(teacherRightEar, 0);
    setMetric(teacherAverageEar, 0);
    setMetric(teacherMar, 0);
    renderFraming(null);
}

async function refreshSnapshot() {
    try {
        const response = await fetchJson('/api/student-state');
        if (!response.snapshot) {
            renderDisconnectedState('Il PC non ha ancora inviato uno stato.');
            return;
        }

        renderSnapshot(response.snapshot, response.commandAck || null);
    } catch (error) {
        renderDisconnectedState('Server o quiz non raggiungibile.');
    }
}

async function sendCommand(type, payload = {}) {
    try {
        setActionStatus('Invio comando al server...');
        const response = await fetchJson('/api/command', {
            method: 'POST',
            body: JSON.stringify({ type, payload })
        });
        lastSentCommandId = response.command && response.command.id ? response.command.id : lastSentCommandId;
        setActionStatus('Comando registrato sul server, in attesa del PC...');
        setCommandDeliveryStatus(`${getCommandLabel(type)}: in attesa di conferma dal PC`);
        return true;
    } catch (error) {
        setActionStatus(`Errore invio: ${error.message}`, true);
        throw error;
    }
}

function buildQuestionPayload() {
    const prompt = teacherQuestionPromptInput.value.trim();
    const options = [
        teacherOptionAInput.value.trim(),
        teacherOptionBInput.value.trim(),
        teacherOptionCInput.value.trim(),
        teacherOptionDInput.value.trim()
    ];

    if (!prompt) {
        throw new Error('Inserisci il testo della domanda.');
    }

    if (options.some((option) => !option)) {
        throw new Error('Compila tutte e quattro le risposte.');
    }

    return {
        title: teacherQuestionTitleInput.value.trim(),
        prompt,
        options,
        correctIndex: Number(teacherCorrectAnswerInput.value)
    };
}

function clearQuestionForm() {
    teacherQuestionTitleInput.value = '';
    teacherQuestionPromptInput.value = '';
    teacherOptionAInput.value = '';
    teacherOptionBInput.value = '';
    teacherOptionCInput.value = '';
    teacherOptionDInput.value = '';
    teacherCorrectAnswerInput.value = '0';
}

async function sendQuestionCommand(commandType) {
    try {
        const question = buildQuestionPayload();
        await sendCommand(commandType, { question });
        clearQuestionForm();
        if (typeof hideExamFlowPanel === 'function') {
            hideExamFlowPanel();
        }
    } catch (error) {
        setActionStatus(error.message, true);
    }
}

if (teacherStartExamBtn) {
    teacherStartExamBtn.addEventListener('click', () => {
        void sendCommand('start-exam');
    });
}

teacherStartCameraBtn.addEventListener('click', () => {
    void sendCommand('start-camera');
});

teacherReadQuestionBtn.addEventListener('click', () => {
    void sendCommand('read-question');
});

teacherScrollBtn.addEventListener('click', () => {
    void sendCommand('simulate-scroll');
});

teacherSelectBtn.addEventListener('click', () => {
    void sendCommand('simulate-select');
});

teacherConfirmBtn.addEventListener('click', () => {
    void sendCommand('simulate-confirm');
});

if (teacherRepeatQuestionBtn) {
    teacherRepeatQuestionBtn.addEventListener('click', () => {
        void sendCommand('repeat-question');
    });
}

if (teacherNextQuestionBtn) {
    teacherNextQuestionBtn.addEventListener('click', () => {
        void sendCommand('next-question');
    });
}

teacherResetBtn.addEventListener('click', () => {
    void sendCommand('reset-flow');
});

if (teacherFinishExamBtn) {
    teacherFinishExamBtn.addEventListener('click', () => {
        const conferma = window.confirm("Terminare l'esame e mostrare i saluti e i ringraziamenti finali sul PC dello studente?");
        if (conferma) {
            void finishExam();
        }
    });
}

if (teacherFramingBtn) {
    teacherFramingBtn.addEventListener('click', () => {
        setFramingVisible(!framingVisible);
    });
}

teacherOpenPresentationBtn.addEventListener('click', () => {
    const url = '/' + PRESENTATION_FILE;
    teacherPresentationStatus.textContent = 'Apertura in corso...';
    void sendCommand('switch-to-presentation', { url }).then(() => {
        teacherPresentationStatus.textContent = 'Video aperto sul PC.';
        if (teacherVideoControls) teacherVideoControls.hidden = false;
    });
});

teacherClosePresentationBtn.addEventListener('click', () => {
    teacherPresentationStatus.textContent = 'Chiusura in corso...';
    void sendCommand('close-presentation').then(() => {
        teacherPresentationStatus.textContent = 'Video chiuso.';
        if (teacherVideoControls) teacherVideoControls.hidden = true;
    });
});

if (teacherVideoPlayBtn) {
    teacherVideoPlayBtn.addEventListener('click', () => { void sendCommand('video-play'); });
}
if (teacherVideoPauseBtn) {
    teacherVideoPauseBtn.addEventListener('click', () => { void sendCommand('video-pause'); });
}
if (teacherVideoRestartBtn) {
    teacherVideoRestartBtn.addEventListener('click', () => { void sendCommand('video-restart'); });
}
if (teacherVideoBackBtn) {
    teacherVideoBackBtn.addEventListener('click', () => { void sendCommand('video-skip-backward'); });
}
if (teacherVideoForwardBtn) {
    teacherVideoForwardBtn.addEventListener('click', () => { void sendCommand('video-skip-forward'); });
}

teacherPublishNowBtn.addEventListener('click', () => {
    void sendQuestionCommand('publish-now');
});

teacherQueueNextBtn.addEventListener('click', () => {
    void sendQuestionCommand('queue-next');
});

window.addEventListener('beforeunload', () => {
    if (snapshotTimer) {
        window.clearInterval(snapshotTimer);
    }
});

const teacherSubjectsStatus = document.getElementById('teacherSubjectsStatus');
const teacherSubjectActions = document.getElementById('teacherSubjectActions');
const teacherSubjectPreview = document.getElementById('teacherSubjectPreview');
const teacherPublishQuizNowTopBtn = document.getElementById('teacherPublishQuizNowTopBtn');
const teacherQueueSubjectBtn = document.getElementById('teacherQueueSubjectBtn');

let loadedSubjectQuestions = null;
let loadedSubjectName = '';
let loadedSubjectKey = '';

function setSubjectsStatus(message, isError = false) {
    if (!teacherSubjectsStatus) return;
    teacherSubjectsStatus.textContent = message;
    teacherSubjectsStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

document.querySelectorAll('.subject-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
        const subject = btn.dataset.subject;
        if (!subject) return;

        document.querySelectorAll('.subject-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        setSubjectsStatus(`Caricamento ${btn.textContent.trim()} in corso...`);
        if (teacherSubjectActions) teacherSubjectActions.hidden = true;
        loadedSubjectQuestions = null;

        try {
            const response = await fetch(`/domande/${subject}.json`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`File non trovato (${response.status}).`);
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) throw new Error('File vuoto o formato non valido.');

            const questions = data.map((q, i) => normalizeQuestion(q, i));
            loadedSubjectQuestions = questions;
            loadedSubjectName = btn.textContent.trim();
            loadedSubjectKey = subject;

            const label = questions.length === 1 ? '1 domanda' : `${questions.length} domande`;
            setSubjectsStatus(`${loadedSubjectName}: ${label} pronte`);
            if (teacherSubjectPreview) {
                teacherSubjectPreview.textContent = `${loadedSubjectName} — ${label} caricate. Usa i pulsanti qui sotto per inviarle al quiz.`;
            }
            if (teacherSubjectActions) teacherSubjectActions.hidden = false;
        } catch (error) {
            setSubjectsStatus(`Errore: ${error.message}`, true);
            document.querySelectorAll('.subject-btn').forEach((b) => b.classList.remove('is-active'));
        }
    });
});

async function sendSubjectQuestionsCommand(commandType) {
    if (!loadedSubjectQuestions || loadedSubjectQuestions.length === 0) {
        setSubjectsStatus('Carica prima le domande di una materia.', true);
        return;
    }
    try {
        await sendCommand(commandType, { questions: loadedSubjectQuestions });
        const label = loadedSubjectQuestions.length === 1 ? '1 domanda' : `${loadedSubjectQuestions.length} domande`;
        setSubjectsStatus(
            commandType === 'publish-batch'
                ? `${loadedSubjectName}: ${label} pubblicate sul quiz.`
                : `${loadedSubjectName}: ${label} aggiunte in coda.`
        );
        if (commandType === 'publish-batch') {
            markSubjectStarted(loadedSubjectKey, loadedSubjectName);
        }
    } catch (error) {
        setSubjectsStatus(`Errore invio: ${error.message}`, true);
    }
}

if (teacherPublishQuizNowTopBtn) {
    teacherPublishQuizNowTopBtn.addEventListener('click', () => {
        void sendSubjectQuestionsCommand('publish-batch');
    });
}

if (teacherQueueSubjectBtn) {
    teacherQueueSubjectBtn.addEventListener('click', () => {
        void sendSubjectQuestionsCommand('queue-batch');
    });
}

// --- Esame guidato: rilevamento materie, fine materia e fine esame ---
const teacherExamFlowCard = document.getElementById('teacherExamFlowCard');
const teacherExamFlowStatus = document.getElementById('teacherExamFlowStatus');
const teacherExamFlowMessage = document.getElementById('teacherExamFlowMessage');
const teacherExamFlowActions = document.getElementById('teacherExamFlowActions');

// Materia caricata automaticamente dallo studente all'avvio (vedi DEFAULT_SUBJECT in app.js).
// La consideriamo gia attiva, cosi il suo completamento viene registrato come per le altre.
const DEFAULT_SUBJECT = 'Italiano';

let examPlan = [];
let examPlanReady = false;
const completedExamSubjects = new Set();
let currentExamSubject = { subject: DEFAULT_SUBJECT, label: DEFAULT_SUBJECT };
let prevSimulationCompleted = false;
let examFlowInitialized = false;
let examFinished = false;

async function probeExamPlan() {
    const buttons = [...document.querySelectorAll('.subject-btn')];
    const plan = [];
    for (const btn of buttons) {
        const subject = btn.dataset.subject;
        if (!subject) continue;
        try {
            const response = await fetch(`/domande/${subject}.json`, { cache: 'no-store' });
            if (!response.ok) continue;
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                plan.push({ subject, label: btn.textContent.trim(), count: data.length });
            }
        } catch (_) {
            /* materia non disponibile: ignora */
        }
    }
    examPlan = plan;
    examPlanReady = true;
}

function hideExamFlowPanel() {
    if (teacherExamFlowCard) teacherExamFlowCard.hidden = true;
}

function markSubjectStarted(subjectKey, subjectLabel) {
    currentExamSubject = subjectKey ? { subject: subjectKey, label: subjectLabel || subjectKey } : null;
    examFinished = false;
    hideExamFlowPanel();
}

function findNextSubject() {
    return examPlan.find((entry) =>
        !completedExamSubjects.has(entry.subject)
        && (!currentExamSubject || entry.subject !== currentExamSubject.subject)
    ) || null;
}

async function publishSubjectByKey(subjectKey, subjectLabel) {
    try {
        setActionStatus(`Caricamento ${subjectLabel} in corso...`);
        const response = await fetch(`/domande/${subjectKey}.json`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`File non trovato (${response.status}).`);
        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('Materia senza domande.');
        const questions = data.map((q, i) => normalizeQuestion(q, i));
        await sendCommand('publish-batch', { questions });
        loadedSubjectQuestions = questions;
        loadedSubjectName = subjectLabel;
        loadedSubjectKey = subjectKey;
        markSubjectStarted(subjectKey, subjectLabel);
        setActionStatus(`${subjectLabel}: ${questions.length === 1 ? '1 domanda' : `${questions.length} domande`} pubblicate sul quiz.`);
    } catch (error) {
        setActionStatus(`Errore invio ${subjectLabel}: ${error.message}`, true);
    }
}

function clearExamFlowActions() {
    if (teacherExamFlowActions) teacherExamFlowActions.innerHTML = '';
}

function addExamFlowButton(label, className, onClick) {
    if (!teacherExamFlowActions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `action-btn ${className}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    teacherExamFlowActions.appendChild(button);
}

function showExamFlowPanel(statusText, messageText) {
    if (!teacherExamFlowCard) return;
    teacherExamFlowCard.hidden = false;
    if (teacherExamFlowStatus) teacherExamFlowStatus.textContent = statusText;
    if (teacherExamFlowMessage) teacherExamFlowMessage.textContent = messageText;
    clearExamFlowActions();
}

function renderSubjectDonePanel() {
    const doneLabel = currentExamSubject ? currentExamSubject.label : 'La materia';
    const next = findNextSubject();
    showExamFlowPanel(
        'Materia completata',
        `${doneLabel} completata. Lo studente e in pausa. Vuoi passare alla prossima materia o sceglierne una dalla banca domande qui sopra?`
    );
    if (next) {
        addExamFlowButton(`Prossima materia: ${next.label}`, 'primary', () => {
            void publishSubjectByKey(next.subject, next.label);
        });
    }
    addExamFlowButton('Scegli una materia', 'secondary', () => {
        hideExamFlowPanel();
        const card = document.querySelector('.teacher-subjects-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

function renderAllDonePanel() {
    showExamFlowPanel(
        'Tutte le materie completate',
        "Lo studente ha completato tutte le materie dell'esame. L'esame e finito oppure vuoi inserire una domanda al momento?"
    );
    addExamFlowButton("Termina l'esame", 'primary', () => {
        void finishExam();
    });
    addExamFlowButton('Inserisci una domanda', 'secondary', () => {
        hideExamFlowPanel();
        const card = document.querySelector('.teacher-compose-card');
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (teacherQuestionPromptInput) teacherQuestionPromptInput.focus();
    });
}

async function finishExam() {
    try {
        await sendCommand('finish-exam');
        examFinished = true;
        showExamFlowPanel(
            'Esame concluso',
            'Esame concluso. Grazie alla commissione e complimenti a Giuseppe per il grande impegno: i ringraziamenti sono mostrati sul PC dello studente.'
        );
    } catch (error) {
        setActionStatus(`Errore chiusura esame: ${error.message}`, true);
    }
}

function handleSubjectCompleted() {
    if (currentExamSubject) {
        completedExamSubjects.add(currentExamSubject.subject);
    }
    const allDone = examPlanReady
        && examPlan.length > 0
        && examPlan.every((entry) => completedExamSubjects.has(entry.subject));
    if (allDone) {
        renderAllDonePanel();
    } else {
        renderSubjectDonePanel();
    }
}

function processExamFlow(snapshot) {
    const completedNow = !!(snapshot && snapshot.simulationCompleted);
    if (!examFlowInitialized) {
        // Se al primo aggiornamento lo studente ha gia concluso la materia attiva
        // (es. pannello aperto/ricaricato dopo la materia di default), registrala
        // subito come fatta per non riproporla.
        if (completedNow && currentExamSubject) {
            completedExamSubjects.add(currentExamSubject.subject);
        }
        prevSimulationCompleted = completedNow;
        examFlowInitialized = true;
        return;
    }
    if (completedNow && !prevSimulationCompleted && !examFinished) {
        handleSubjectCompleted();
    }
    prevSimulationCompleted = completedNow;
}

renderDisconnectedState('Connessione iniziale in corso...');
void probeExamPlan();
void refreshSnapshot();
snapshotTimer = window.setInterval(() => {
    void refreshSnapshot();
}, SNAPSHOT_REFRESH_MS);
