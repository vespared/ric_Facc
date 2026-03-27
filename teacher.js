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

const teacherStartCameraBtn = document.getElementById('teacherStartCameraBtn');
const teacherReadQuestionBtn = document.getElementById('teacherReadQuestionBtn');
const teacherScrollBtn = document.getElementById('teacherScrollBtn');
const teacherSelectBtn = document.getElementById('teacherSelectBtn');
const teacherConfirmBtn = document.getElementById('teacherConfirmBtn');
const teacherResetBtn = document.getElementById('teacherResetBtn');
const teacherPublishNowBtn = document.getElementById('teacherPublishNowBtn');
const teacherQueueNextBtn = document.getElementById('teacherQueueNextBtn');
const teacherPublishDocxBtn = document.getElementById('teacherPublishDocxBtn');
const teacherQueueDocxBtn = document.getElementById('teacherQueueDocxBtn');

const teacherQuestionTitleInput = document.getElementById('teacherQuestionTitleInput');
const teacherQuestionPromptInput = document.getElementById('teacherQuestionPromptInput');
const teacherOptionAInput = document.getElementById('teacherOptionAInput');
const teacherOptionBInput = document.getElementById('teacherOptionBInput');
const teacherOptionCInput = document.getElementById('teacherOptionCInput');
const teacherOptionDInput = document.getElementById('teacherOptionDInput');
const teacherCorrectAnswerInput = document.getElementById('teacherCorrectAnswerInput');
const teacherQuestionDocxInput = document.getElementById('teacherQuestionDocxInput');
const teacherImportStatus = document.getElementById('teacherImportStatus');

let snapshotTimer = null;
let lastSentCommandId = 0;

function getCommandLabel(type) {
    switch (type) {
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
        default:
            return type || 'Comando remoto';
    }
}

function normalizeHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
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

    if (!prompt) {
        throw new Error(`Domanda ${index + 1}: testo domanda mancante.`);
    }

    if (options.length !== 4 || options.some((option) => !option)) {
        throw new Error(`Domanda ${index + 1}: servono esattamente 4 opzioni compilate.`);
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

function splitQuestionBlocks(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const blocks = [];
    let currentBlock = [];

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            return;
        }

        if (/^---+$/.test(line)) {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join('\n'));
                currentBlock = [];
            }
            return;
        }

        const separatorIndex = line.indexOf(':');
        const key = separatorIndex >= 0 ? normalizeHeader(line.slice(0, separatorIndex)) : '';
        const isQuestionStart = ['title', 'titolo'].includes(key);

        if (isQuestionStart && currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
        }

        currentBlock.push(line);
    });

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
    }

    return blocks.filter(Boolean);
}

function parseTxtQuestions(text) {
    const blocks = splitQuestionBlocks(text);

    if (blocks.length === 0) {
        throw new Error('Il file Word non contiene domande valide.');
    }

    return blocks.map((block, index) => {
        const rawQuestion = {};
        block.split(/\r?\n/).forEach((line) => {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex < 0) {
                return;
            }

            const key = normalizeHeader(line.slice(0, separatorIndex));
            const value = line.slice(separatorIndex + 1).trim();

            if (['title', 'titolo'].includes(key)) {
                rawQuestion.title = value;
            } else if (['prompt', 'question', 'domanda', 'testo'].includes(key)) {
                rawQuestion.prompt = value;
            } else if (['a', 'optiona', 'opzionea'].includes(key)) {
                rawQuestion.optionA = value;
            } else if (['b', 'optionb', 'opzioneb'].includes(key)) {
                rawQuestion.optionB = value;
            } else if (['c', 'optionc', 'opzionec'].includes(key)) {
                rawQuestion.optionC = value;
            } else if (['d', 'optiond', 'opzioned'].includes(key)) {
                rawQuestion.optionD = value;
            } else if (['correct', 'corretta', 'answer', 'risposta'].includes(key)) {
                rawQuestion.correct = value;
            }
        });

        return normalizeQuestion(rawQuestion, index);
    });
}

async function parseDocxQuestions(file) {
    if (typeof mammoth === 'undefined') {
        throw new Error('Libreria Word non disponibile nel browser.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result || !result.value || !result.value.trim()) {
        throw new Error('Il file DOCX non contiene testo leggibile.');
    }

    return parseTxtQuestions(result.value);
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

function setImportStatus(message, isError = false) {
    if (!teacherImportStatus) {
        return;
    }

    teacherImportStatus.textContent = message;
    teacherImportStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
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
    } catch (error) {
        setActionStatus(error.message, true);
    }
}

async function sendDocxQuestionCommand(commandType) {
    const file = teacherQuestionDocxInput.files && teacherQuestionDocxInput.files[0];
    if (!file) {
        setImportStatus('Seleziona prima un file Word.', true);
        setActionStatus('Seleziona prima un file Word.', true);
        return;
    }

    try {
        setImportStatus(`Lettura di ${file.name} in corso...`);
        const questions = await parseDocxQuestions(file);
        await sendCommand(commandType, { questions });

        const label = questions.length === 1 ? '1 domanda' : `${questions.length} domande`;
        setImportStatus(`Import completato: ${file.name} (${label})`);
        setActionStatus(
            commandType === 'publish-batch'
                ? `File Word pubblicato sul quiz: ${label}.`
                : `File Word aggiunto in coda: ${label}.`
        );
        teacherQuestionDocxInput.value = '';
    } catch (error) {
        setImportStatus(`Errore import: ${error.message}`, true);
        setActionStatus(error.message, true);
    }
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

teacherResetBtn.addEventListener('click', () => {
    void sendCommand('reset-flow');
});

teacherPublishNowBtn.addEventListener('click', () => {
    void sendQuestionCommand('publish-now');
});

teacherQueueNextBtn.addEventListener('click', () => {
    void sendQuestionCommand('queue-next');
});

if (teacherPublishDocxBtn) {
    teacherPublishDocxBtn.addEventListener('click', () => {
        void sendDocxQuestionCommand('publish-batch');
    });
}

if (teacherQueueDocxBtn) {
    teacherQueueDocxBtn.addEventListener('click', () => {
        void sendDocxQuestionCommand('queue-batch');
    });
}

window.addEventListener('beforeunload', () => {
    if (snapshotTimer) {
        window.clearInterval(snapshotTimer);
    }
});

setImportStatus('Formato richiesto: title, prompt, A, B, C, D, correct.');
renderDisconnectedState('Connessione iniziale in corso...');
void refreshSnapshot();
snapshotTimer = window.setInterval(() => {
    void refreshSnapshot();
}, SNAPSHOT_REFRESH_MS);
