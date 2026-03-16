const OPTION_LETTERS = ['A', 'B', 'C', 'D'];
const SNAPSHOT_REFRESH_MS = 1200;

const teacherConnectionStatus = document.getElementById('teacherConnectionStatus');
const teacherPhaseBadge = document.getElementById('teacherPhaseBadge');
const teacherQuestionBadge = document.getElementById('teacherQuestionBadge');
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

const teacherQuestionTitleInput = document.getElementById('teacherQuestionTitleInput');
const teacherQuestionPromptInput = document.getElementById('teacherQuestionPromptInput');
const teacherOptionAInput = document.getElementById('teacherOptionAInput');
const teacherOptionBInput = document.getElementById('teacherOptionBInput');
const teacherOptionCInput = document.getElementById('teacherOptionCInput');
const teacherOptionDInput = document.getElementById('teacherOptionDInput');
const teacherCorrectAnswerInput = document.getElementById('teacherCorrectAnswerInput');

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

function setConnectionStatus(message, isError = false) {
    teacherConnectionStatus.textContent = message;
    teacherConnectionStatus.style.color = isError ? 'var(--red)' : 'var(--text)';
}

function setActionStatus(message, isError = false) {
    teacherActionStatus.textContent = message;
    teacherActionStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
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

function renderSnapshot(snapshot) {
    const updatedAt = snapshot.updatedAt ? new Date(snapshot.updatedAt) : null;
    const isFresh = updatedAt && (Date.now() - updatedAt.getTime()) < 5000;

    setConnectionStatus(isFresh ? 'Collegato' : 'Segnale debole', !isFresh);
    teacherPhaseBadge.textContent = snapshot.phaseLabel || '-';
    teacherQuestionBadge.textContent = snapshot.questionCounterLabel || '-';
    teacherLastUpdate.textContent = updatedAt
        ? `Ultimo aggiornamento: ${updatedAt.toLocaleTimeString('it-IT')}`
        : 'Nessun dato ricevuto';

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

        renderSnapshot(response.snapshot);
    } catch (error) {
        renderDisconnectedState('Server o quiz non raggiungibile.');
    }
}

async function sendCommand(type, payload = {}) {
    try {
        setActionStatus('Invio comando al PC...');
        await fetchJson('/api/command', {
            method: 'POST',
            body: JSON.stringify({ type, payload })
        });
        setActionStatus('Comando inviato al PC');
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
