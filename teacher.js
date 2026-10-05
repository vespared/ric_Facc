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
const teacherRepeatQuestionBtn = document.getElementById('teacherRepeatQuestionBtn');
const teacherNextQuestionBtn = document.getElementById('teacherNextQuestionBtn');
const teacherResetBtn = document.getElementById('teacherResetBtn');
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

// Header studente e materia
const currentStudentNameDisplay = document.getElementById('currentStudentNameDisplay');
const currentSubjectNameDisplay = document.getElementById('currentSubjectNameDisplay');
const currentStudentFolderDisplay = document.getElementById('currentStudentFolderDisplay');
const changeStudentBtn = document.getElementById('changeStudentBtn');

// Alert test sospeso
const teacherSuspendedAlertCard = document.getElementById('teacherSuspendedAlertCard');
const suspendedSubjectBadge = document.getElementById('suspendedSubjectBadge');
const suspendedDateBadge = document.getElementById('suspendedDateBadge');
const suspendedProgressBadge = document.getElementById('suspendedProgressBadge');
const suspendedScoreBadge = document.getElementById('suspendedScoreBadge');
const teacherResumeSessionBtn = document.getElementById('teacherResumeSessionBtn');
const teacherRestartSessionBtn = document.getElementById('teacherRestartSessionBtn');
const teacherNewSessionBtn = document.getElementById('teacherNewSessionBtn');

// Alert test completato
const teacherCompletedAlertCard = document.getElementById('teacherCompletedAlertCard');
const completedTestTitle = document.getElementById('completedTestTitle');
const completedTestMessage = document.getElementById('completedTestMessage');
const teacherPrintCompletedBtn = document.getElementById('teacherPrintCompletedBtn');
const teacherDismissCompletedBtn = document.getElementById('teacherDismissCompletedBtn');

// Archivio risultati
const teacherArchiveCard = document.getElementById('teacherArchiveCard');
const teacherArchiveStatus = document.getElementById('teacherArchiveStatus');
const refreshArchiveBtn = document.getElementById('refreshArchiveBtn');
const archiveDirHint = document.getElementById('archiveDirHint');
const teacherArchiveList = document.getElementById('teacherArchiveList');

// Banca materie
const teacherSubjectsCard = document.getElementById('teacherSubjectsCard');
const teacherSubjectsStatus = document.getElementById('teacherSubjectsStatus');
const teacherSubjectButtons = document.querySelectorAll('.subject-btn');
const teacherSubjectPreviewArea = document.getElementById('teacherSubjectPreviewArea');
const teacherSubjectNameBadge = document.getElementById('teacherSubjectNameBadge');
const teacherSubjectCountBadge = document.getElementById('teacherSubjectCountBadge');
const teacherSubjectPreviewPrompt = document.getElementById('teacherSubjectPreviewPrompt');
const teacherPublishSubjectBtn = document.getElementById('teacherPublishSubjectBtn');
const teacherQueueSubjectBtn = document.getElementById('teacherQueueSubjectBtn');
const teacherClearSubjectBtn = document.getElementById('teacherClearSubjectBtn');

let currentActiveStudent = 'Martinelli';
let currentActiveSubject = 'Italiano';
let activeSuspendedSession = null;
let activeCompletedResult = null;
let selectedSubjectQuestions = null;
let selectedSubjectName = null;

function escapeTeacherHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        case 'repeat-question':
            return 'Ripeti domanda';
        case 'next-question':
            return 'Domanda successiva';
        case 'resume-session':
            return 'Riprendi test sospeso';
        case 'restart-session':
            return 'Rinizia test dall\'inizio';
        case 'new-session':
            return 'Nuovo test';
        case 'set-student':
            return 'Imposta studente';
        case 'set-subject':
            return 'Imposta materia';
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

    const normalized = String(value ?? '').trim();
    if (!normalized) {
        return null;
    }

    const upper = normalized.toUpperCase();
    const numeric = Number.parseInt(normalized, 10);

    if (OPTION_LETTERS.includes(upper)) {
        const idx = OPTION_LETTERS.indexOf(upper);
        if (idx < options.length) {
            return idx;
        }
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

    throw new Error(`Domanda ${questionIndex + 1}: risposta corretta "${value}" non valida per ${options.length} opzioni.`);
}

function normalizeHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function splitCsvLine(line) {
    const values = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const nextChar = line[index + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                current += '"';
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

function normalizeQuestion(rawQuestion, index) {
    const title = String(rawQuestion.title || rawQuestion.titolo || `Domanda ${index + 1}`).trim();
    const prompt = String(rawQuestion.prompt || rawQuestion.question || rawQuestion.domanda || rawQuestion.testo || rawQuestion.testodomanda || rawQuestion.quesito || '').trim();
    
    let rawOpts = Array.isArray(rawQuestion.options)
        ? rawQuestion.options
        : [
            rawQuestion.optionA || rawQuestion.opzioneA || rawQuestion.rispostaA || rawQuestion.a || rawQuestion.opzione1 || rawQuestion.risposta1,
            rawQuestion.optionB || rawQuestion.opzioneB || rawQuestion.rispostaB || rawQuestion.b || rawQuestion.opzione2 || rawQuestion.risposta2,
            rawQuestion.optionC || rawQuestion.opzioneC || rawQuestion.rispostaC || rawQuestion.c || rawQuestion.opzione3 || rawQuestion.risposta3,
            rawQuestion.optionD || rawQuestion.opzioneD || rawQuestion.rispostaD || rawQuestion.d || rawQuestion.opzione4 || rawQuestion.risposta4
        ];

    const options = rawOpts
        .map((option) => String(option ?? '').trim())
        .filter(Boolean);

    if (!prompt) {
        throw new Error(`Domanda ${index + 1}: testo domanda mancante.`);
    }

    if (options.length < 2 || options.length > 4) {
        throw new Error(`Domanda ${index + 1}: servono da 2 a 4 risposte compilate (trovate ${options.length}).`);
    }

    return {
        title,
        prompt,
        options,
        correctIndex: resolveCorrectIndex(
            rawQuestion.correctIndex ?? rawQuestion.correct ?? rawQuestion.corretta ?? rawQuestion.rispostaesatta ?? rawQuestion.rispostacorretta ?? rawQuestion.esatta ?? rawQuestion.answer ?? rawQuestion.risposta ?? rawQuestion.soluzione,
            options,
            index
        )
    };
}

function mapRowToQuestion(row, rowIndex) {
    const normalizedRow = Object.entries(row).reduce((accumulator, [key, value]) => {
        accumulator[normalizeHeader(key)] = value;
        return accumulator;
    }, {});

    const title = normalizedRow.title || normalizedRow.titolo || `Domanda ${rowIndex + 1}`;
    const prompt = normalizedRow.prompt || normalizedRow.question || normalizedRow.domanda || normalizedRow.testo || normalizedRow.testodomanda || normalizedRow.quesito;
    const optA = normalizedRow.optiona || normalizedRow.opzionea || normalizedRow.rispostaa || normalizedRow.a || normalizedRow.opzione1 || normalizedRow.risposta1 || '';
    const optB = normalizedRow.optionb || normalizedRow.opzioneb || normalizedRow.rispostab || normalizedRow.b || normalizedRow.opzione2 || normalizedRow.risposta2 || '';
    const optC = normalizedRow.optionc || normalizedRow.opzionec || normalizedRow.rispostac || normalizedRow.c || normalizedRow.opzione3 || normalizedRow.risposta3 || '';
    const optD = normalizedRow.optiond || normalizedRow.opzioned || normalizedRow.rispostad || normalizedRow.d || normalizedRow.opzione4 || normalizedRow.risposta4 || '';
    const correct = normalizedRow.correct ?? normalizedRow.corretta ?? normalizedRow.rispostaesatta ?? normalizedRow.rispostacorretta ?? normalizedRow.esatta ?? normalizedRow.answer ?? normalizedRow.risposta ?? normalizedRow.soluzione ?? normalizedRow.chiave;

    const rawOptions = [optA, optB, optC, optD]
        .map((opt) => String(opt || '').trim())
        .filter(Boolean);

    return normalizeQuestion({
        title,
        prompt,
        options: rawOptions,
        correct
    }, rowIndex);
}

function parseCsvQuestions(text) {
    const rows = text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');

    if (rows.length < 2) {
        throw new Error('Il CSV deve contenere intestazione e almeno una domanda.');
    }

    const headers = splitCsvLine(rows[0]).map(normalizeHeader);
    const findColumn = (variants) => headers.findIndex((header) => variants.includes(header));

    const titleIndex = findColumn(['title', 'titolo']);
    const promptIndex = findColumn(['prompt', 'question', 'domanda', 'testo', 'testodomanda', 'quesito']);
    const optionAIndex = findColumn(['optiona', 'opzionea', 'rispostaa', 'a', 'opzione1', 'risposta1']);
    const optionBIndex = findColumn(['optionb', 'opzioneb', 'rispostab', 'b', 'opzione2', 'risposta2']);
    const optionCIndex = findColumn(['optionc', 'opzionec', 'rispostac', 'c', 'opzione3', 'risposta3']);
    const optionDIndex = findColumn(['optiond', 'opzioned', 'rispostad', 'd', 'opzione4', 'risposta4']);
    const correctIndex = findColumn(['correct', 'corretta', 'rispostaesatta', 'rispostacorretta', 'esatta', 'answer', 'risposta', 'soluzione', 'chiave']);

    if (promptIndex < 0 || optionAIndex < 0 || optionBIndex < 0) {
        throw new Error('Il CSV deve contenere almeno le colonne: Domanda, Risposta A, Risposta B.');
    }

    return rows.slice(1).map((line, rowIndex) => {
        const columns = splitCsvLine(line);
        const optA = optionAIndex >= 0 ? columns[optionAIndex] : '';
        const optB = optionBIndex >= 0 ? columns[optionBIndex] : '';
        const optC = optionCIndex >= 0 ? columns[optionCIndex] : '';
        const optD = optionDIndex >= 0 ? columns[optionDIndex] : '';
        const rawOptions = [optA, optB, optC, optD].map((opt) => String(opt || '').trim()).filter(Boolean);

        return normalizeQuestion({
            title: titleIndex >= 0 && columns[titleIndex] ? columns[titleIndex] : `Domanda ${rowIndex + 1}`,
            prompt: columns[promptIndex],
            options: rawOptions,
            correct: correctIndex >= 0 ? columns[correctIndex] : null
        }, rowIndex);
    });
}

function parseXlsxQuestions(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Libreria Excel non ancora caricata nel browser.');
    }
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error('Il file Excel non contiene fogli leggibili.');
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) {
        throw new Error('Il file Excel non contiene righe con domande.');
    }
    return rows.map((row, index) => mapRowToQuestion(row, index));
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
    let payload = {};
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (e) {
        if (!response.ok) {
            throw new Error(text || `Richiesta non riuscita (${response.status}).`);
        }
        throw new Error('Risposta del server non valida.');
    }

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

    if (snapshot.quizSession) {
        if (snapshot.quizSession.student && currentStudentNameDisplay) {
            currentStudentNameDisplay.textContent = snapshot.quizSession.student;
            currentActiveStudent = snapshot.quizSession.student;
        }
        if (snapshot.quizSession.subject && currentSubjectNameDisplay) {
            currentSubjectNameDisplay.textContent = snapshot.quizSession.subject;
            currentActiveSubject = snapshot.quizSession.subject;
        }
        if (currentStudentFolderDisplay) {
            currentStudentFolderDisplay.textContent = `studenti/${currentActiveStudent}`;
        }
    }

    if (snapshot.currentQuestion) {
        teacherQuestionTitle.textContent = snapshot.currentQuestion.title;
        teacherQuestionPrompt.textContent = snapshot.currentQuestion.prompt;
    } else if (snapshot.simulationCompleted) {
        teacherQuestionTitle.textContent = 'Test completato';
        teacherQuestionPrompt.textContent = 'Lo studente ha completato tutte le domande del quiz.';
    } else {
        teacherQuestionTitle.textContent = 'Quiz non ancora pronto';
        teacherQuestionPrompt.textContent = 'In attesa di una domanda attiva dal PC.';
    }

    if (snapshot.simulationCompleted) {
        const session = snapshot.quizSession || {};
        activeCompletedResult = {
            student: session.student || currentActiveStudent,
            subject: session.subject || currentActiveSubject,
            score: session.score || {},
            fileName: session.fileName || null
        };
        if (completedTestTitle) {
            completedTestTitle.textContent = `Quiz di ${activeCompletedResult.subject} completato!`;
        }
        if (completedTestMessage) {
            const pct = activeCompletedResult.score?.percentuale ?? 0;
            const esatte = activeCompletedResult.score?.esatte ?? 0;
            const errate = activeCompletedResult.score?.errate ?? 0;
            const total = snapshot.questionCount || (esatte + errate);
            completedTestMessage.textContent = `Lo studente ${activeCompletedResult.student} ha concluso il test con punteggio ${pct}% (${esatte} risposte esatte, ${errate} errate su ${total} domande).`;
        }
        if (teacherCompletedAlertCard) teacherCompletedAlertCard.hidden = false;
    }

    setMetric(teacherLeftEar, snapshot.metrics && snapshot.metrics.leftEar);
    setMetric(teacherRightEar, snapshot.metrics && snapshot.metrics.rightEar);
    setMetric(teacherAverageEar, snapshot.metrics && snapshot.metrics.averageEar);
    setMetric(teacherMar, snapshot.metrics && snapshot.metrics.mar);

    renderChoices(snapshot);
    renderEvents(snapshot);
    renderFraming(snapshot.framing || null);
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

// --- Gestione Scelte Domanda Singola Live (2, 3 o 4 opzioni) ---
let currentComposeOptionCount = 4;
const teacherFieldC = document.getElementById('teacherFieldC');
const teacherFieldD = document.getElementById('teacherFieldD');
const countPills = document.querySelectorAll('.count-pill');

function updateComposeOptionCount(count) {
    currentComposeOptionCount = count;
    countPills.forEach((pill) => {
        pill.classList.toggle('is-active', Number(pill.dataset.count) === count);
    });

    if (teacherFieldC) {
        teacherFieldC.style.display = count >= 3 ? '' : 'none';
        if (count < 3 && teacherOptionCInput) teacherOptionCInput.value = '';
    }
    if (teacherFieldD) {
        teacherFieldD.style.display = count >= 4 ? '' : 'none';
        if (count < 4 && teacherOptionDInput) teacherOptionDInput.value = '';
    }

    // Aggiorna opzioni nel select della risposta esatta
    if (teacherCorrectAnswerInput) {
        const previousVal = Number(teacherCorrectAnswerInput.value);
        teacherCorrectAnswerInput.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = OPTION_LETTERS[i];
            teacherCorrectAnswerInput.appendChild(opt);
        }
        teacherCorrectAnswerInput.value = previousVal < count ? String(previousVal) : '0';
    }
}

countPills.forEach((pill) => {
    pill.addEventListener('click', () => {
        const count = Number(pill.dataset.count) || 4;
        updateComposeOptionCount(count);
    });
});

updateComposeOptionCount(4);

function buildQuestionPayload() {
    const prompt = teacherQuestionPromptInput.value.trim();
    const count = currentComposeOptionCount;
    const title = teacherQuestionTitleInput.value.trim() || 'Domanda live';
    
    const allOptions = [
        teacherOptionAInput.value.trim(),
        teacherOptionBInput.value.trim(),
        teacherOptionCInput ? teacherOptionCInput.value.trim() : '',
        teacherOptionDInput ? teacherOptionDInput.value.trim() : ''
    ];
    const options = allOptions.slice(0, count);

    if (!prompt) {
        throw new Error('Inserisci il testo della domanda.');
    }

    if (options.some((option) => !option)) {
        throw new Error(`Compila tutte le ${count} risposte richieste.`);
    }

    const selectedIdx = Number(teacherCorrectAnswerInput.value);
    if (selectedIdx < 0 || selectedIdx >= count) {
        throw new Error('Seleziona una risposta corretta valida per il numero di scelte.');
    }

    return {
        title,
        prompt,
        options,
        correctIndex: selectedIdx
    };
}

function clearQuestionForm() {
    teacherQuestionTitleInput.value = '';
    teacherQuestionPromptInput.value = '';
    teacherOptionAInput.value = '';
    teacherOptionBInput.value = '';
    if (teacherOptionCInput) teacherOptionCInput.value = '';
    if (teacherOptionDInput) teacherOptionDInput.value = '';
    if (teacherCorrectAnswerInput) teacherCorrectAnswerInput.value = '0';
}

async function sendQuestionCommand(commandType) {
    try {
        const question = buildQuestionPayload();
        await sendCommand(commandType, { question });
        clearQuestionForm();
        setActionStatus(`Domanda "${question.title}" (${question.options.length} scelte) inviata al quiz.`);
    } catch (error) {
        setActionStatus(error.message, true);
        alert(`Attenzione: ${error.message}`);
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

if (teacherFramingBtn) {
    teacherFramingBtn.addEventListener('click', () => {
        setFramingVisible(!framingVisible);
    });
}

teacherPublishNowBtn.addEventListener('click', () => {
    void sendQuestionCommand('publish-now');
});

teacherQueueNextBtn.addEventListener('click', () => {
    void sendQuestionCommand('queue-next');
});

// --- Gestione Importazione Domande da Excel / CSV ---
const teacherExcelStatus = document.getElementById('teacherExcelStatus');
const teacherDropzone = document.getElementById('teacherDropzone');
const teacherExcelFileInput = document.getElementById('teacherExcelFileInput');
const teacherDownloadXlsxTemplateBtn = document.getElementById('teacherDownloadXlsxTemplateBtn');
const teacherDownloadCsvTemplateBtn = document.getElementById('teacherDownloadCsvTemplateBtn');
const teacherExcelPreviewArea = document.getElementById('teacherExcelPreviewArea');
const teacherExcelFileName = document.getElementById('teacherExcelFileName');
const teacherExcelQuestionCount = document.getElementById('teacherExcelQuestionCount');
const teacherExcelStatsBadge = document.getElementById('teacherExcelStatsBadge');
const teacherExcelPreviewList = document.getElementById('teacherExcelPreviewList');
const teacherPublishExcelBtn = document.getElementById('teacherPublishExcelBtn');
const teacherQueueExcelBtn = document.getElementById('teacherQueueExcelBtn');
const teacherClearExcelBtn = document.getElementById('teacherClearExcelBtn');

let loadedExcelQuestions = null;
let loadedExcelFileName = '';

function setExcelStatus(message, isError = false) {
    if (!teacherExcelStatus) return;
    teacherExcelStatus.textContent = message;
    teacherExcelStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 600);
}

function downloadXlsxTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Libreria Excel in caricamento. Prova tra qualche istante o scarica il modello CSV.');
        return;
    }

    const rows = [
        {
            "Titolo": "Esempio 4 Scelte",
            "Domanda": "Quale pianeta del nostro sistema solare e conosciuto come il Pianeta Rosso?",
            "Risposta A": "Marte",
            "Risposta B": "Giove",
            "Risposta C": "Venere",
            "Risposta D": "Nettuno",
            "Risposta Esatta": "A"
        },
        {
            "Titolo": "Esempio 3 Scelte",
            "Domanda": "Quale fra questi e uno stato fisico fondamentale della materia?",
            "Risposta A": "Solido",
            "Risposta B": "Elettrico",
            "Risposta C": "Magnetico",
            "Risposta D": "",
            "Risposta Esatta": "A"
        },
        {
            "Titolo": "Esempio 2 Scelte (Vero/Falso)",
            "Domanda": "Il Sole e una stella situata al centro del nostro sistema planetario?",
            "Risposta A": "Vero",
            "Risposta B": "Falso",
            "Risposta C": "",
            "Risposta D": "",
            "Risposta Esatta": "A"
        }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
        { wch: 22 },
        { wch: 48 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Domande Quiz");
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, 'modello-domande-quiz.xlsx');
    setExcelStatus('Modello Excel (.xlsx) scaricato');
}

function downloadCsvTemplate() {
    const csvContent = [
        'Titolo,Domanda,Risposta A,Risposta B,Risposta C,Risposta D,Risposta Esatta',
        '"Esempio 4 Scelte","Quale pianeta del nostro sistema solare e conosciuto come il Pianeta Rosso?","Marte","Giove","Venere","Nettuno","A"',
        '"Esempio 3 Scelte","Quale fra questi e uno stato fisico fondamentale della materia?","Solido","Elettrico","Magnetico","","A"',
        '"Esempio 2 Scelte (Vero/Falso)","Il Sole e una stella situata al centro del nostro sistema planetario?","Vero","Falso","","","A"'
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, 'modello-domande-quiz.csv');
    setExcelStatus('Modello CSV (.csv) scaricato');
}

if (teacherDownloadXlsxTemplateBtn) {
    teacherDownloadXlsxTemplateBtn.addEventListener('click', downloadXlsxTemplate);
}
if (teacherDownloadCsvTemplateBtn) {
    teacherDownloadCsvTemplateBtn.addEventListener('click', downloadCsvTemplate);
}

function clearLoadedExcel() {
    loadedExcelQuestions = null;
    loadedExcelFileName = '';
    if (teacherExcelFileInput) teacherExcelFileInput.value = '';
    if (teacherExcelPreviewArea) teacherExcelPreviewArea.hidden = true;
    if (teacherDropzone) teacherDropzone.hidden = false;
    setExcelStatus('Carica file .xlsx o .csv');
}

if (teacherClearExcelBtn) {
    teacherClearExcelBtn.addEventListener('click', clearLoadedExcel);
}

function renderExcelPreview(questions, fileName) {
    loadedExcelQuestions = questions;
    loadedExcelFileName = fileName;

    if (teacherExcelFileName) teacherExcelFileName.textContent = fileName;
    if (teacherExcelQuestionCount) {
        teacherExcelQuestionCount.textContent = `${questions.length} ${questions.length === 1 ? 'domanda' : 'domande'} pronte`;
    }

    const count2 = questions.filter(q => q.options.length === 2).length;
    const count3 = questions.filter(q => q.options.length === 3).length;
    const count4 = questions.filter(q => q.options.length === 4).length;

    if (teacherExcelStatsBadge) {
        const badges = [];
        if (count4 > 0) badges.push(`<span class="badge-opt count-4">${count4} a 4 risposte</span>`);
        if (count3 > 0) badges.push(`<span class="badge-opt count-3">${count3} a 3 risposte</span>`);
        if (count2 > 0) badges.push(`<span class="badge-opt count-2">${count2} a 2 risposte</span>`);
        teacherExcelStatsBadge.innerHTML = badges.join('');
    }

    if (teacherExcelPreviewList) {
        teacherExcelPreviewList.innerHTML = questions.map((q, idx) => `
            <div class="excel-preview-card">
                <div class="excel-preview-card-head">
                    <span class="excel-preview-card-idx">#${idx + 1}</span>
                    <strong class="excel-preview-card-title">${escapeHtml(q.title)}</strong>
                    <span class="excel-preview-card-badge">${q.options.length} scelte</span>
                </div>
                <p class="excel-preview-card-prompt">${escapeHtml(q.prompt)}</p>
                <div class="excel-preview-card-options">
                    ${q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctIndex === optIdx;
                        return `<span class="preview-opt-item ${isCorrect ? 'is-correct' : ''}">
                            <strong>${OPTION_LETTERS[optIdx]}</strong> ${escapeHtml(opt)} ${isCorrect ? '✓' : ''}
                        </span>`;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    if (teacherDropzone) teacherDropzone.hidden = true;
    if (teacherExcelPreviewArea) teacherExcelPreviewArea.hidden = false;
    setExcelStatus(`${fileName}: ${questions.length} domande lette con successo!`);
}

async function handleExcelFile(file) {
    if (!file) return;
    const extension = String(file.name.split('.').pop() || '').toLowerCase();
    setExcelStatus(`Elaborazione ${file.name} in corso...`);

    try {
        let questions;
        if (extension === 'csv') {
            const text = await file.text();
            questions = parseCsvQuestions(text);
        } else if (extension === 'xlsx' || extension === 'xls') {
            const buffer = await file.arrayBuffer();
            questions = parseXlsxQuestions(buffer);
        } else {
            throw new Error('Formato non supportato. Carica un file .xlsx, .xls o .csv.');
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Nessuna domanda valida trovata nel file.');
        }

        renderExcelPreview(questions, file.name);
    } catch (error) {
        console.error('Errore parsing Excel:', error);
        setExcelStatus(`Errore: ${error.message}`, true);
        alert(`Errore file Excel: ${error.message}`);
    }
}

if (teacherExcelFileInput) {
    teacherExcelFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleExcelFile(file);
    });
}

if (teacherDropzone) {
    teacherDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        teacherDropzone.classList.add('is-dragover');
    });
    teacherDropzone.addEventListener('dragleave', () => {
        teacherDropzone.classList.remove('is-dragover');
    });
    teacherDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        teacherDropzone.classList.remove('is-dragover');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleExcelFile(file);
    });
}

// Pulsanti invio comandi da file Excel
if (teacherPublishExcelBtn) {
    teacherPublishExcelBtn.addEventListener('click', async () => {
        if (!loadedExcelQuestions || loadedExcelQuestions.length === 0) {
            setExcelStatus('Nessun file con domande caricato.', true);
            return;
        }
        try {
            await sendCommand('publish-batch', { questions: loadedExcelQuestions });
            const count = loadedExcelQuestions.length;
            setExcelStatus(`Pubblicate ${count} domande sul quiz dal file ${loadedExcelFileName}!`);
            setActionStatus(`Quiz avviato con ${count} domande caricate da Excel.`);
        } catch (error) {
            setExcelStatus(`Errore invio: ${error.message}`, true);
        }
    });
}

if (teacherQueueExcelBtn) {
    teacherQueueExcelBtn.addEventListener('click', async () => {
        if (!loadedExcelQuestions || loadedExcelQuestions.length === 0) {
            setExcelStatus('Nessun file con domande caricato.', true);
            return;
        }
        try {
            await sendCommand('queue-batch', { questions: loadedExcelQuestions });
            const count = loadedExcelQuestions.length;
            setExcelStatus(`Aggiunte ${count} domande in coda dal file ${loadedExcelFileName}.`);
            setActionStatus(`${count} domande aggiunte in coda sul quiz.`);
        } catch (error) {
            setExcelStatus(`Errore invio: ${error.message}`, true);
        }
    });
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

// ==========================================
// GESTIONE STUDENTE, TEST SOSPESO E ARCHIVIO
// ==========================================

async function fetchStudentInfo() {
    try {
        const data = await fetchJson('/api/student/info');
        if (data) {
            currentActiveStudent = data.activeStudent || currentActiveStudent;
            currentActiveSubject = data.activeSubject || currentActiveSubject;
            if (currentStudentNameDisplay) currentStudentNameDisplay.textContent = currentActiveStudent;
            if (currentSubjectNameDisplay) currentSubjectNameDisplay.textContent = currentActiveSubject;
            if (currentStudentFolderDisplay) currentStudentFolderDisplay.textContent = `studenti/${currentActiveStudent}`;
            if (archiveDirHint) archiveDirHint.textContent = `Cartella: studenti/${currentActiveStudent}`;
        }
        await checkSuspendedSession();
        await loadResultsArchive();
    } catch (e) {
        console.warn('Errore recupero info studente:', e);
    }
}

async function checkSuspendedSession() {
    try {
        const data = await fetchJson('/api/quiz/active-session');
        if (data && data.session && Array.isArray(data.session.domande) && data.session.domande.length > 0) {
            activeSuspendedSession = data.session;
            if (suspendedSubjectBadge) suspendedSubjectBadge.textContent = data.session.materia || '-';
            if (suspendedDateBadge) suspendedDateBadge.textContent = data.session.dataInizio || data.session.data || '-';
            const totalQ = data.session.totaleDomande || data.session.domande?.length || 0;
            const answeredCount = Array.isArray(data.session.answers) ? data.session.answers.filter(Boolean).length : 0;
            if (suspendedProgressBadge) suspendedProgressBadge.textContent = `${answeredCount} / ${totalQ} risposte fornite (domanda ${(data.session.currentQuestionIndex || 0) + 1})`;
            if (suspendedScoreBadge && data.session.score) {
                suspendedScoreBadge.textContent = `${data.session.score.esatte || 0} esatte, ${data.session.score.errate || 0} errate (${data.session.score.percentuale || 0}%)`;
            }
            if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = false;
        } else {
            activeSuspendedSession = null;
            if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = true;
        }
    } catch (e) {
        if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = true;
    }
}

if (teacherResumeSessionBtn) {
    teacherResumeSessionBtn.addEventListener('click', async () => {
        if (!activeSuspendedSession) return;
        try {
            await sendCommand('resume-session', { session: activeSuspendedSession });
            await fetchJson('/api/quiz/session-action', {
                method: 'POST',
                body: JSON.stringify({ action: 'resume' })
            });
            setActionStatus(`Test di ${activeSuspendedSession.materia} ripreso sul PC.`);
            if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = true;
        } catch (e) {
            setActionStatus(`Errore ripresa test: ${e.message}`, true);
        }
    });
}

if (teacherRestartSessionBtn) {
    teacherRestartSessionBtn.addEventListener('click', async () => {
        if (!activeSuspendedSession) return;
        if (!confirm(`Vuoi davvero riniziare il test di ${activeSuspendedSession.materia} dalla prima domanda? Le risposte già registrate verranno azzerate.`)) {
            return;
        }
        try {
            await sendCommand('restart-session', { session: activeSuspendedSession });
            await fetchJson('/api/quiz/session-action', {
                method: 'POST',
                body: JSON.stringify({ action: 'restart' })
            });
            setActionStatus(`Test di ${activeSuspendedSession.materia} riavviato dall'inizio sul PC.`);
            if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = true;
        } catch (e) {
            setActionStatus(`Errore riavvio test: ${e.message}`, true);
        }
    });
}

if (teacherNewSessionBtn) {
    teacherNewSessionBtn.addEventListener('click', async () => {
        try {
            await sendCommand('new-session', {});
            await fetchJson('/api/quiz/session-action', {
                method: 'POST',
                body: JSON.stringify({ action: 'new' })
            });
            setActionStatus('Test sospeso archiviato. Pronto per un nuovo test.');
            if (teacherSuspendedAlertCard) teacherSuspendedAlertCard.hidden = true;
            activeSuspendedSession = null;
        } catch (e) {
            setActionStatus(`Errore: ${e.message}`, true);
        }
    });
}

if (teacherPrintCompletedBtn) {
    teacherPrintCompletedBtn.addEventListener('click', () => {
        const student = activeCompletedResult?.student || currentActiveStudent;
        const file = activeCompletedResult?.fileName || '';
        const url = `/stampa-risultato?student=${encodeURIComponent(student)}&file=${encodeURIComponent(file)}&autoPrint=1`;
        window.open(url, '_blank');
    });
}

if (teacherDismissCompletedBtn) {
    teacherDismissCompletedBtn.addEventListener('click', () => {
        if (teacherCompletedAlertCard) teacherCompletedAlertCard.hidden = true;
    });
}

async function loadResultsArchive() {
    if (!teacherArchiveList) return;
    try {
        if (teacherArchiveStatus) teacherArchiveStatus.textContent = 'Caricamento...';
        const data = await fetchJson(`/api/quiz/results?student=${encodeURIComponent(currentActiveStudent)}`);
        const files = Array.isArray(data.files) ? data.files : (Array.isArray(data.results) ? data.results : []);
        if (teacherArchiveStatus) {
            teacherArchiveStatus.textContent = files.length === 1 ? '1 quiz archiviato' : `${files.length} quiz archiviati`;
        }

        if (files.length === 0) {
            teacherArchiveList.innerHTML = `
                <div class="archive-empty">
                    <p>Nessun quiz archiviato finora per <strong>${escapeTeacherHtml(currentActiveStudent)}</strong>.</p>
                    <small>I quiz conclusi verranno salvati automaticamente in <code>studenti/${escapeTeacherHtml(currentActiveStudent)}</code> con nome materia e data.</small>
                </div>
            `;
            return;
        }

        teacherArchiveList.innerHTML = files.map((f) => {
            const isParziale = f.isParziale;
            const badgeClass = isParziale ? 'status-warning' : 'status-success';
            const badgeText = isParziale ? 'Parziale / Sospeso' : 'Completato';
            const scoreText = f.score ? `${f.score.percentuale || 0}% (${f.score.esatte || 0} esatte, ${f.score.errate || 0} errate)` : '-';
            const printBtnHtml = !isParziale ? `
                <a href="/stampa-risultato?student=${encodeURIComponent(currentActiveStudent)}&file=${encodeURIComponent(f.fileName)}&autoPrint=1"
                   target="_blank" class="action-btn primary teacher-btn-xs" title="Stampa o Salva in formato PDF">
                   🖨️ Stampa PDF
                </a>
            ` : '';

            return `
                <div class="archive-entry">
                    <div class="archive-entry-main">
                        <div class="archive-entry-top">
                            <strong class="archive-subject">${escapeTeacherHtml(f.materia || 'Quiz')}</strong>
                            <span class="status-pill ${badgeClass}">${badgeText}</span>
                            <span class="archive-date">${escapeTeacherHtml(f.data || '')}</span>
                        </div>
                        <div class="archive-entry-meta">
                            <span>Esito: <strong>${scoreText}</strong></span>
                            <span>File: <code>${escapeTeacherHtml(f.fileName)}</code></span>
                        </div>
                    </div>
                    <div class="archive-entry-actions">
                        ${printBtnHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Errore caricamento archivio:', e);
        if (teacherArchiveStatus) teacherArchiveStatus.textContent = 'Errore';
        teacherArchiveList.innerHTML = `<p class="archive-error">Errore nel caricamento dei risultati: ${e.message}</p>`;
    }
}

if (refreshArchiveBtn) {
    refreshArchiveBtn.addEventListener('click', () => {
        void loadResultsArchive();
    });
}

// ------------------------------------------
// BANCA MATERIE
// ------------------------------------------
teacherSubjectButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
        const subject = btn.dataset.subject;
        if (!subject) return;

        teacherSubjectButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        try {
            if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = `Caricamento ${subject}...`;
            const questions = await fetchJson(`/domande/${encodeURIComponent(subject)}.json`);
            if (!Array.isArray(questions) || questions.length === 0) {
                if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = `${subject} non contiene ancora domande.`;
                if (teacherSubjectPreviewArea) teacherSubjectPreviewArea.hidden = true;
                return;
            }

            selectedSubjectQuestions = questions;
            selectedSubjectName = subject;

            if (teacherSubjectNameBadge) teacherSubjectNameBadge.textContent = subject;
            if (teacherSubjectCountBadge) teacherSubjectCountBadge.textContent = `${questions.length} domande pronte`;
            if (teacherSubjectPreviewPrompt) {
                teacherSubjectPreviewPrompt.textContent = `1ª domanda: "${questions[0].prompt || questions[0].title}" (${questions[0].options?.length || 0} opzioni)`;
            }
            if (teacherSubjectPreviewArea) teacherSubjectPreviewArea.hidden = false;
            if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = `Selezionato: ${subject} (${questions.length} domande)`;
        } catch (e) {
            console.error('Errore caricamento materia:', e);
            if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = `Errore caricamento ${subject}: ${e.message}`;
            if (teacherSubjectPreviewArea) teacherSubjectPreviewArea.hidden = true;
        }
    });
});

if (teacherClearSubjectBtn) {
    teacherClearSubjectBtn.addEventListener('click', () => {
        selectedSubjectQuestions = null;
        selectedSubjectName = null;
        if (teacherSubjectPreviewArea) teacherSubjectPreviewArea.hidden = true;
        teacherSubjectButtons.forEach((b) => b.classList.remove('is-active'));
        if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = 'Scegli una materia';
    });
}

if (teacherPublishSubjectBtn) {
    teacherPublishSubjectBtn.addEventListener('click', async () => {
        if (!selectedSubjectQuestions || selectedSubjectQuestions.length === 0) {
            setActionStatus('Nessuna materia selezionata.', true);
            return;
        }
        try {
            await sendCommand('publish-batch', {
                questions: selectedSubjectQuestions,
                subject: selectedSubjectName
            });
            await fetchJson('/api/students/active', {
                method: 'POST',
                body: JSON.stringify({ activeSubject: selectedSubjectName })
            });
            currentActiveSubject = selectedSubjectName;
            if (currentSubjectNameDisplay) currentSubjectNameDisplay.textContent = selectedSubjectName;
            setActionStatus(`Quiz avviato con ${selectedSubjectQuestions.length} domande di ${selectedSubjectName}!`);
            if (teacherSubjectsStatus) teacherSubjectsStatus.textContent = `Pubblicato con successo: ${selectedSubjectName}!`;
            await checkSuspendedSession();
        } catch (e) {
            setActionStatus(`Errore pubblicazione: ${e.message}`, true);
        }
    });
}

if (teacherQueueSubjectBtn) {
    teacherQueueSubjectBtn.addEventListener('click', async () => {
        if (!selectedSubjectQuestions || selectedSubjectQuestions.length === 0) {
            setActionStatus('Nessuna materia selezionata.', true);
            return;
        }
        try {
            await sendCommand('queue-batch', {
                questions: selectedSubjectQuestions,
                subject: selectedSubjectName
            });
            setActionStatus(`${selectedSubjectQuestions.length} domande di ${selectedSubjectName} aggiunte in coda sul PC.`);
        } catch (e) {
            setActionStatus(`Errore invio in coda: ${e.message}`, true);
        }
    });
}

void fetchStudentInfo();

