const CONFIG = {
    earThreshold: 0.13,
    marThreshold: 0.17,
    glassesMode: true,
    earBufferSize: 15,
    scrollActivationMs: 300,
    scrollCooldownMs: 1000,
    selectHoldMs: 1000,
    answerAdvanceDelayMs: 2200,
    eventLogSize: 8
};

localStorage.setItem('earThreshold', String(CONFIG.earThreshold));
localStorage.setItem('marThreshold', String(CONFIG.marThreshold));
localStorage.setItem('glassesMode', String(CONFIG.glassesMode));

let EAR_THRESHOLD = CONFIG.earThreshold;
let MAR_THRESHOLD = CONFIG.marThreshold;
let isGlassesMode = CONFIG.glassesMode;

const DEFAULT_QUESTION_SET = [
    {
        title: 'Domanda 1',
        prompt: 'Quale pianeta e conosciuto come Pianeta Rosso?',
        options: ['Marte', 'Giove', 'Venere', 'Nettuno'],
        correctIndex: 0
    },
    {
        title: 'Domanda 2',
        prompt: 'Quale materia prima e usata per fare il vetro tradizionale?',
        options: ['Sabbia', 'Legno', 'Argilla', 'Rame'],
        correctIndex: 0
    },
    {
        title: 'Domanda 3',
        prompt: 'In un quiz Kahoot, cosa succede dopo la conferma finale della risposta?',
        options: ['La risposta viene registrata', 'Il quiz si chiude subito', 'La webcam si spegne', 'Il timer torna a zero'],
        correctIndex: 0
    }
];

let questionSet = cloneQuestionSet(DEFAULT_QUESTION_SET);

const CHOICE_THEMES = [
    'linear-gradient(135deg, #36d8ff, #246bff)',
    'linear-gradient(135deg, #ff9b54, #ff5f7a)',
    'linear-gradient(135deg, #8f7cff, #5a47ff)',
    'linear-gradient(135deg, #6ff7a8, #2eba74)'
];

const STATE_META = {
    idle: {
        label: 'LETTURA',
        phase: 'Lettura',
        instruction: 'Apri la bocca per attivare la risposta.',
        pill: 'linear-gradient(135deg, #ffd166, #ffb547)'
    },
    focus: {
        label: 'NAVIGAZIONE',
        phase: 'Navigazione',
        instruction: 'Apri la bocca per scorrere. Chiudi gli occhi per selezionare.',
        pill: 'linear-gradient(135deg, #36d8ff, #2a8cff)'
    },
    preselect: {
        label: 'PRE-SELEZIONE',
        phase: 'Pre-selezione',
        instruction: 'Mantieni gli occhi chiusi fino al completamento della barra.',
        pill: 'linear-gradient(135deg, #2de2e6, #ffd166)'
    },
    confirm: {
        label: 'SAFE CHECK',
        phase: 'Conferma',
        instruction: 'Apri la bocca per confermare o tieni gli occhi chiusi per annullare.',
        pill: 'linear-gradient(135deg, #71f79f, #2de2e6)'
    },
    answered: {
        label: 'RISPOSTA REGISTRATA',
        phase: 'Confermata',
        instruction: 'Risposta registrata. Preparazione della prossima domanda...',
        pill: 'linear-gradient(135deg, #71f79f, #35bb74)'
    },
    done: {
        label: 'TEST COMPLETATO',
        phase: 'Completato',
        instruction: 'Simulazione completata. Premi reset per ricominciare.',
        pill: 'linear-gradient(135deg, #ff5fa2, #8f7cff)'
    }
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

function cloneQuestionSet(sourceQuestions) {
    return sourceQuestions.map((question, index) => normalizeQuestion(question, index));
}

let leftEarBuffer = [];
let rightEarBuffer = [];
let latestEarLeft = 0;
let latestEarRight = 0;
let latestMar = 0;

let isRunning = false;
let camera = null;
let currentQuestionIndex = 0;
let currentState = 'idle';
let focusedIndex = -1;
let selectedIndex = null;
let answerLockedIndex = null;
let optionProgress = 0;
let confirmProgress = 0;
let confirmProgressMode = 'confirm';
let confirmCancelEnabled = false;
let simulationCompleted = false;
let nextQuestionTimer = null;
let manualLock = false;
let demoRunning = false;
let lastScrollAt = 0;
let mouthOpenStartedAt = null;
let mouthCommandLocked = false;
let eyeHoldStartedAt = null;
let cancelHoldStartedAt = null;
let audioContext = null;
let choiceButtons = [];

const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingOverlay = document.getElementById('loading');
const startBtn = document.getElementById('startBtn');
const readQuestionBtn = document.getElementById('readQuestionBtn');
const zoomCanvas = document.getElementById('zoomCanvas');
const zoomCtx = zoomCanvas.getContext('2d');

const elLeftEyeStatus = document.getElementById('leftEyeStatus');
const elLeftEyeEar = document.getElementById('leftEyeEar');
const elLeftEyeCard = document.getElementById('leftEyeCard');
const elRightEyeStatus = document.getElementById('rightEyeStatus');
const elRightEyeEar = document.getElementById('rightEyeEar');
const elRightEyeCard = document.getElementById('rightEyeCard');
const elMouthStatus = document.getElementById('mouthStatus');
const elMouthMar = document.getElementById('mouthMar');
const elMouthCard = document.getElementById('mouthCard');

const cameraState = document.getElementById('cameraState');
const questionTitle = document.getElementById('questionTitle');
const questionCounter = document.getElementById('questionCounter');
const questionText = document.getElementById('questionText');
const systemState = document.getElementById('systemState');
const systemInstruction = document.getElementById('systemInstruction');
const mouthCommandLabel = document.getElementById('mouthCommandLabel');
const eyesCommandLabel = document.getElementById('eyesCommandLabel');
const choicesGrid = document.getElementById('choicesGrid');
const confirmCard = document.getElementById('confirmCard');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmProgressBar = document.getElementById('confirmProgressBar');
const avgEarValue = document.getElementById('avgEarValue');
const liveMarValue = document.getElementById('liveMarValue');
const commandState = document.getElementById('commandState');
const phaseState = document.getElementById('phaseState');
const eventLog = document.getElementById('eventLog');

const simulateScrollBtn = document.getElementById('simulateScrollBtn');
const simulateSelectBtn = document.getElementById('simulateSelectBtn');
const simulateConfirmBtn = document.getElementById('simulateConfirmBtn');
const runDemoBtn = document.getElementById('runDemoBtn');
const resetFlowBtn = document.getElementById('resetFlowBtn');
const questionFileInput = document.getElementById('questionFileInput');
const downloadCsvTemplateBtn = document.getElementById('downloadCsvTemplateBtn');
const downloadJsonTemplateBtn = document.getElementById('downloadJsonTemplateBtn');
const restoreDefaultQuestionsBtn = document.getElementById('restoreDefaultQuestionsBtn');
const importStatus = document.getElementById('importStatus');
const remoteSyncStatus = document.getElementById('remoteSyncStatus');
const teacherUrlHint = document.getElementById('teacherUrlHint');

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const REMOTE_SYNC_ENABLED = window.location.protocol === 'http:' || window.location.protocol === 'https:';

let remoteStatePushInFlight = false;
let remoteStatePushQueued = false;
let remoteCommandPollInFlight = false;
let remoteLastCommandId = null;
let remoteStateTimer = null;
let remoteCommandTimer = null;

const remoteEventHistory = [];

function currentQuestion() {
    return questionSet[currentQuestionIndex];
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

    const correctIndex = resolveCorrectIndex(
        rawQuestion.correctIndex ?? rawQuestion.correct ?? rawQuestion.corretta ?? rawQuestion.answer ?? rawQuestion.risposta,
        options,
        index
    );

    return {
        title,
        prompt,
        options,
        correctIndex
    };
}

function updateImportStatus(message, isError = false) {
    importStatus.textContent = message;
    importStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function setRemoteSyncStatus(message, isError = false) {
    if (!remoteSyncStatus) {
        return;
    }
    remoteSyncStatus.textContent = message;
    remoteSyncStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function updateTeacherUrlHint() {
    if (!teacherUrlHint) {
        return;
    }

    teacherUrlHint.textContent = REMOTE_SYNC_ENABLED
        ? `Pannello docente: ${window.location.origin}/teacher.html`
        : 'Pannello docente disponibile avviando server.js e aprendo il quiz via http://localhost:3000';
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

function buildStudentSnapshot() {
    const question = simulationCompleted ? null : currentQuestion();
    return {
        isRunning,
        cameraState: cameraState.textContent,
        currentState,
        phaseLabel: phaseState.textContent,
        commandLabel: commandState.textContent,
        currentQuestionIndex,
        questionCount: questionSet.length,
        simulationCompleted,
        focusedIndex,
        selectedIndex,
        answerLockedIndex,
        questionCounterLabel: `${Math.min(currentQuestionIndex + 1, questionSet.length)} / ${questionSet.length}`,
        metrics: {
            leftEar: Number(latestEarLeft.toFixed(3)),
            rightEar: Number(latestEarRight.toFixed(3)),
            averageEar: Number((((latestEarLeft + latestEarRight) / 2) || 0).toFixed(3)),
            mar: Number(latestMar.toFixed(3))
        },
        currentQuestion: question ? {
            title: question.title,
            prompt: question.prompt,
            options: [...question.options],
            correctIndex: question.correctIndex
        } : null,
        events: remoteEventHistory.slice(0, CONFIG.eventLogSize),
        updatedAt: new Date().toISOString()
    };
}

async function pushStudentSnapshot() {
    if (!REMOTE_SYNC_ENABLED || !remoteStatePushQueued) {
        return;
    }
    if (remoteStatePushInFlight) {
        return;
    }

    remoteStatePushInFlight = true;
    remoteStatePushQueued = false;

    try {
        await fetchJson('/api/student-state', {
            method: 'POST',
            body: JSON.stringify(buildStudentSnapshot())
        });
        setRemoteSyncStatus('Server docente collegato sulla rete locale');
    } catch (error) {
        setRemoteSyncStatus('Server docente non raggiungibile', true);
    } finally {
        remoteStatePushInFlight = false;
        if (remoteStatePushQueued) {
            void pushStudentSnapshot();
        }
    }
}

function requestStudentSnapshotSync() {
    if (!REMOTE_SYNC_ENABLED) {
        return;
    }
    remoteStatePushQueued = true;
    void pushStudentSnapshot();
}

function mapRowToQuestion(row, rowIndex) {
    const normalizedRow = Object.entries(row).reduce((accumulator, [key, value]) => {
        accumulator[normalizeHeader(key)] = value;
        return accumulator;
    }, {});

    return normalizeQuestion({
        title: normalizedRow.title || normalizedRow.titolo || `Domanda ${rowIndex + 1}`,
        prompt: normalizedRow.prompt || normalizedRow.question || normalizedRow.domanda || normalizedRow.testo || normalizedRow.testodomanda,
        optionA: normalizedRow.optiona || normalizedRow.opzionea || normalizedRow.a,
        optionB: normalizedRow.optionb || normalizedRow.opzioneb || normalizedRow.b,
        optionC: normalizedRow.optionc || normalizedRow.opzionec || normalizedRow.c,
        optionD: normalizedRow.optiond || normalizedRow.opzioned || normalizedRow.d,
        correct: normalizedRow.correct || normalizedRow.corretta || normalizedRow.answer || normalizedRow.rispostaesatta || normalizedRow.risposta
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
    const promptIndex = findColumn(['prompt', 'question', 'domanda', 'testo', 'testodomanda']);
    const optionAIndex = findColumn(['optiona', 'opzionea', 'a']);
    const optionBIndex = findColumn(['optionb', 'opzioneb', 'b']);
    const optionCIndex = findColumn(['optionc', 'opzionec', 'c']);
    const optionDIndex = findColumn(['optiond', 'opzioned', 'd']);
    const correctIndex = findColumn(['correct', 'corretta', 'answer', 'rispostaesatta', 'risposta']);

    if ([promptIndex, optionAIndex, optionBIndex, optionCIndex, optionDIndex, correctIndex].some((index) => index < 0)) {
        throw new Error('Il CSV deve avere le colonne: prompt, optionA, optionB, optionC, optionD, correct.');
    }

    return rows.slice(1).map((line, rowIndex) => {
        const columns = splitCsvLine(line);
        return normalizeQuestion({
            title: titleIndex >= 0 ? columns[titleIndex] : `Domanda ${rowIndex + 1}`,
            prompt: columns[promptIndex],
            optionA: columns[optionAIndex],
            optionB: columns[optionBIndex],
            optionC: columns[optionCIndex],
            optionD: columns[optionDIndex],
            correct: columns[correctIndex]
        }, rowIndex);
    });
}

function parseXlsxQuestions(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Libreria Excel non disponibile nel browser.');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error('Il file XLSX non contiene fogli leggibili.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) {
        throw new Error('Il file XLSX non contiene righe di domande.');
    }

    return rows.map((row, index) => mapRowToQuestion(row, index));
}

function splitQuestionBlocks(text) {
    return text
        .replace(/^\uFEFF/, '')
        .split(/\r?\n\s*(?:---+)?\s*\r?\n(?=(?:title|titolo|prompt|question|domanda)\s*:)/i)
        .map((block) => block.trim())
        .filter(Boolean);
}

function parseTxtQuestions(text) {
    const blocks = splitQuestionBlocks(text);

    if (blocks.length === 0) {
        throw new Error('Il file TXT non contiene domande valide.');
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

async function parseDocxQuestions(arrayBuffer) {
    if (typeof mammoth === 'undefined') {
        throw new Error('Libreria Word non disponibile nel browser.');
    }

    const result = await mammoth.extractRawText({ arrayBuffer });
    if (!result || !result.value || !result.value.trim()) {
        throw new Error('Il file DOCX non contiene testo leggibile.');
    }

    return parseTxtQuestions(result.value);
}

function parseJsonQuestions(text) {
    const payload = JSON.parse(text);
    const questions = Array.isArray(payload) ? payload : payload.questions;
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Il JSON deve contenere un array di domande.');
    }
    return questions.map((question, index) => normalizeQuestion(question, index));
}

async function parseQuestionFile(file) {
    const extension = String(file.name.split('.').pop() || '').toLowerCase();

    if (extension === 'csv' || extension === 'json' || extension === 'txt') {
        const text = await file.text();
        if (extension === 'csv') {
            return parseCsvQuestions(text);
        }
        if (extension === 'json') {
            return parseJsonQuestions(text);
        }
        return parseTxtQuestions(text);
    }

    if (extension === 'xlsx') {
        const arrayBuffer = await file.arrayBuffer();
        return parseXlsxQuestions(arrayBuffer);
    }

    if (extension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        return parseDocxQuestions(arrayBuffer);
    }

    throw new Error('Formato non supportato. Usa XLSX, DOCX, CSV, JSON o TXT.');
}

function applyImportedQuestions(questions, sourceLabel) {
    questionSet = cloneQuestionSet(questions);
    resetCurrentFlow(true);
    updateImportStatus(`Caricato: ${sourceLabel} (${questionSet.length} domande)`);
    logEvent(`Import completato da ${sourceLabel}: ${questionSet.length} domande.`);
    speakText(`Test caricato con ${questionSet.length} domande.`, { interrupt: true, rate: 1.01, pitch: 1.08 });
}

function downloadTextFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function createCsvTemplate() {
    return [
        'title,prompt,optionA,optionB,optionC,optionD,correct',
        'Domanda 1,Quale pianeta e conosciuto come Pianeta Rosso?,Marte,Giove,Venere,Nettuno,A',
        'Domanda 2,Quale comando attiva lo scroll della risposta?,Apertura bocca,Chiusura occhi,Rotazione testa,Sorriso,A'
    ].join('\n');
}

function createJsonTemplate() {
    return JSON.stringify(DEFAULT_QUESTION_SET, null, 2);
}

function getTxtTemplate() {
    return [
        'title: Domanda 1',
        'prompt: Quale pianeta e conosciuto come Pianeta Rosso?',
        'A: Marte',
        'B: Giove',
        'C: Venere',
        'D: Nettuno',
        'correct: A',
        '---',
        'title: Domanda 2',
        'prompt: Quale comando attiva lo scroll della risposta?',
        'A: Apertura bocca',
        'B: Chiusura occhi',
        'C: Rotazione testa',
        'D: Sorriso',
        'correct: A'
    ].join('\n');
}

function insertQuestionIntoFlow(rawQuestion, insertIndex) {
    const nextQuestions = questionSet.map((question) => ({
        ...question,
        options: [...question.options]
    }));

    nextQuestions.splice(insertIndex, 0, rawQuestion);
    questionSet = cloneQuestionSet(nextQuestions);
    return questionSet[insertIndex];
}

function publishQuestionNow(rawQuestion, source = 'Tablet docente') {
    const insertIndex = Math.min(Math.max(currentQuestionIndex, 0), questionSet.length);
    const insertedQuestion = insertQuestionIntoFlow(rawQuestion, insertIndex);

    simulationCompleted = false;
    currentQuestionIndex = insertIndex;
    resetCurrentFlow(false);
    updateImportStatus(`Domanda live pubblicata da ${source}`);
    logEvent(`${source}: pubblicata subito ${insertedQuestion.title}.`);
    speakText(`Nuova domanda del docente disponibile ora. ${insertedQuestion.title}.`, {
        interrupt: true,
        rate: 1.03,
        pitch: 1.05
    });
}

function queueQuestionAsNext(rawQuestion, source = 'Tablet docente') {
    const insertIndex = simulationCompleted
        ? questionSet.length
        : Math.min(currentQuestionIndex + 1, questionSet.length);
    const insertedQuestion = insertQuestionIntoFlow(rawQuestion, insertIndex);

    if (simulationCompleted) {
        simulationCompleted = false;
        currentQuestionIndex = insertIndex;
        resetCurrentFlow(false);
        updateImportStatus(`Domanda live aggiunta e aperta da ${source}`);
        logEvent(`${source}: il test riparte con ${insertedQuestion.title} aggiunta in coda.`);
        speakText(`Nuova domanda aggiunta dal docente. ${insertedQuestion.title}.`, {
            interrupt: true,
            rate: 1.03,
            pitch: 1.05
        });
        return;
    }

    updateQuestionHeader();
    renderChoices();
    updateStateUI();
    updateImportStatus(`Domanda aggiunta in coda da ${source}`);
    logEvent(`${source}: aggiunta in coda ${insertedQuestion.title}.`);
    speakText(`Domanda del docente aggiunta come prossima domanda.`, {
        interrupt: true,
        rate: 1.02,
        pitch: 1.04
    });
}

async function executeRemoteCommand(command) {
    const payload = command.payload || {};

    if (command.type === 'start-camera') {
        await startCamera();
        return;
    }

    if (command.type === 'read-question') {
        ensureAudioContext();
        readCurrentQuestion();
        return;
    }

    if (command.type === 'simulate-scroll') {
        ensureAudioContext();
        handleScrollCommand('Tablet docente');
        return;
    }

    if (command.type === 'simulate-select') {
        ensureAudioContext();
        if (currentState === 'confirm') {
            await simulateEyeHold('cancel', 'Tablet docente');
        } else {
            await simulateEyeHold('select', 'Tablet docente');
        }
        return;
    }

    if (command.type === 'simulate-confirm') {
        ensureAudioContext();
        if (currentState === 'confirm') {
            confirmSelection('Tablet docente');
        } else {
            logEvent('Tablet docente: conferma ignorata, safe check non attivo.');
        }
        return;
    }

    if (command.type === 'reset-flow') {
        resetCurrentFlow(true);
        logEvent('Tablet docente: reset completo della simulazione.');
        speakText('Simulazione resettata dal professore.', { interrupt: true, rate: 1.03 });
        return;
    }

    if (command.type === 'publish-now') {
        publishQuestionNow(payload.question || {}, 'Tablet docente');
        return;
    }

    if (command.type === 'queue-next') {
        queueQuestionAsNext(payload.question || {}, 'Tablet docente');
    }
}

async function pollRemoteCommands() {
    if (!REMOTE_SYNC_ENABLED || remoteCommandPollInFlight) {
        return;
    }

    remoteCommandPollInFlight = true;

    try {
        const after = remoteLastCommandId === null ? 0 : remoteLastCommandId;
        const response = await fetchJson(`/api/commands?after=${after}`);
        const commands = Array.isArray(response.commands) ? response.commands : [];
        const latestCommandId = Number(response.latestCommandId || 0);

        if (remoteLastCommandId === null) {
            remoteLastCommandId = latestCommandId;
            return;
        }

        for (const command of commands) {
            try {
                await executeRemoteCommand(command);
            } catch (error) {
                console.error('Errore comando remoto:', error);
                logEvent(`Comando remoto fallito: ${error.message}`);
            }
            remoteLastCommandId = command.id;
        }

        if (commands.length === 0) {
            remoteLastCommandId = Math.max(remoteLastCommandId, latestCommandId);
        }

        setRemoteSyncStatus('Server docente collegato sulla rete locale');
    } catch (error) {
        setRemoteSyncStatus('Server docente non raggiungibile', true);
    } finally {
        remoteCommandPollInFlight = false;
    }
}

function startRemoteSync() {
    updateTeacherUrlHint();

    if (!REMOTE_SYNC_ENABLED) {
        setRemoteSyncStatus('Apri il quiz tramite server locale per collegare il tablet docente');
        return;
    }

    setRemoteSyncStatus('Sincronizzazione docente in avvio...');
    requestStudentSnapshotSync();
    void pollRemoteCommands();

    remoteStateTimer = window.setInterval(() => {
        requestStudentSnapshotSync();
    }, 1200);

    remoteCommandTimer = window.setInterval(() => {
        void pollRemoteCommands();
    }, 900);
}

function getDistance(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function calculateEAR(eyeLandmarks, allLandmarks) {
    const p1 = allLandmarks[eyeLandmarks[0]];
    const p2 = allLandmarks[eyeLandmarks[1]];
    const p3 = allLandmarks[eyeLandmarks[2]];
    const p4 = allLandmarks[eyeLandmarks[3]];
    const p5 = allLandmarks[eyeLandmarks[4]];
    const p6 = allLandmarks[eyeLandmarks[5]];
    const distVertical1 = getDistance(p2, p6);
    const distVertical2 = getDistance(p3, p5);
    const distHorizontal = getDistance(p1, p4);
    if (distHorizontal === 0) {
        return 0;
    }
    return (distVertical1 + distVertical2) / (2 * distHorizontal);
}

function calculateMAR(allLandmarks) {
    const pLeft = allLandmarks[78];
    const pRight = allLandmarks[308];
    const pTop = allLandmarks[13];
    const pBottom = allLandmarks[14];
    const distVertical = getDistance(pTop, pBottom);
    const distHorizontal = getDistance(pLeft, pRight);
    if (distHorizontal === 0) {
        return 0;
    }
    return distVertical / distHorizontal;
}

function smoothValue(newValue, buffer) {
    buffer.push(newValue);
    if (buffer.length > CONFIG.earBufferSize) {
        buffer.shift();
    }
    const sorted = [...buffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function updateSensorCard(cardElement, statusElement, valueElement, value, threshold, noun) {
    valueElement.textContent = value.toFixed(3);
    const isOpen = value > threshold;
    cardElement.classList.remove('state-open', 'state-closed');
    cardElement.classList.add(isOpen ? 'state-open' : 'state-closed');
    statusElement.textContent = noun === 'mouth'
        ? (isOpen ? 'APERTA' : 'CHIUSA')
        : (isOpen ? 'APERTO' : 'CHIUSO');
}

function flashCard(cardElement) {
    cardElement.classList.add('command-hit');
    window.setTimeout(() => cardElement.classList.remove('command-hit'), 450);
}

function ensureAudioContext() {
    if (!window.AudioContext && !window.webkitAudioContext) {
        return null;
    }
    if (!audioContext) {
        const AudioEngine = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioEngine();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function playTone(frequency, durationMs = 120, type = 'sine', gainValue = 0.08) {
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gainValue, now + 0.012);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
}

function playChime(type) {
    if (type === 'scroll') {
        playTone(820, 90, 'square', 0.11);
        window.setTimeout(() => playTone(1040, 65, 'triangle', 0.07), 45);
    } else if (type === 'select') {
        playTone(430, 150, 'triangle', 0.1);
        window.setTimeout(() => playTone(620, 160, 'triangle', 0.095), 100);
        window.setTimeout(() => playTone(740, 160, 'sine', 0.08), 210);
    } else if (type === 'confirm') {
        playTone(660, 160, 'triangle', 0.11);
        window.setTimeout(() => playTone(880, 180, 'triangle', 0.12), 120);
        window.setTimeout(() => playTone(1100, 220, 'sine', 0.09), 230);
    } else if (type === 'cancel') {
        playTone(340, 140, 'sawtooth', 0.1);
        window.setTimeout(() => playTone(250, 180, 'sawtooth', 0.08), 120);
    }
}

function scoreItalianVoice(voice) {
    const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    const lang = (voice.lang || '').toLowerCase();

    if (!lang.startsWith('it')) {
        return -1000;
    }

    let score = 0;
    if (lang === 'it-it') {
        score += 20;
    }
    if (name.includes('natural') || name.includes('online')) {
        score += 40;
    }
    if (name.includes('female') || name.includes('woman')) {
        score += 18;
    }
    if (name.includes('elsa') || name.includes('alice') || name.includes('federica') || name.includes('lucia') || name.includes('giulia') || name.includes('isabella')) {
        score += 35;
    }
    if (name.includes('google') || name.includes('microsoft')) {
        score += 10;
    }
    if (voice.localService) {
        score += 6;
    }

    return score;
}

function getItalianVoice() {
    if (!('speechSynthesis' in window)) {
        return null;
    }
    const voices = window.speechSynthesis.getVoices();
    return voices
        .filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith('it'))
        .sort((left, right) => scoreItalianVoice(right) - scoreItalianVoice(left))[0] || null;
}

function speakText(text, options = {}) {
    if (!('speechSynthesis' in window)) {
        return;
    }
    const { interrupt = false, rate = 0.98, pitch = 1.12, volume = 1 } = options;
    if (interrupt) {
        window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    const voice = getItalianVoice();
    if (voice) {
        utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
}

function setCommandState(label) {
    commandState.textContent = label;
    requestStudentSnapshotSync();
}

function logEvent(message) {
    const createdAt = new Date();
    const item = document.createElement('li');
    const time = createdAt.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    remoteEventHistory.unshift({
        time,
        message,
        createdAt: createdAt.toISOString()
    });
    while (remoteEventHistory.length > CONFIG.eventLogSize) {
        remoteEventHistory.pop();
    }
    item.innerHTML = `<span class="log-time">${time}</span><span class="log-text">${message}</span>`;
    eventLog.prepend(item);
    while (eventLog.children.length > CONFIG.eventLogSize) {
        eventLog.removeChild(eventLog.lastElementChild);
    }
    requestStudentSnapshotSync();
}

function updateQuestionHeader() {
    if (simulationCompleted) {
        questionTitle.textContent = 'Test completato';
        questionCounter.textContent = `${questionSet.length} / ${questionSet.length}`;
        questionText.textContent = 'Flusso validato: attivazione, scrolling, preselezione e conferma hanno completato il test. Premi "Resetta domanda" per ricominciare.';
        requestStudentSnapshotSync();
        return;
    }
    const question = currentQuestion();
    questionTitle.textContent = question.title;
    questionCounter.textContent = `${currentQuestionIndex + 1} / ${questionSet.length}`;
    questionText.textContent = question.prompt;
    requestStudentSnapshotSync();
}

function syncConfirmCard() {
    const showConfirm = currentState === 'confirm';
    confirmCard.classList.toggle('hidden', !showConfirm);
    if (!showConfirm || selectedIndex === null) {
        confirmProgress = 0;
        confirmProgressBar.style.transform = 'scaleX(0)';
        return;
    }
    const label = OPTION_LETTERS[selectedIndex];
    const option = currentQuestion().options[selectedIndex];
    confirmTitle.textContent = `Hai scelto la ${label}`;
    confirmText.textContent = `Risposta in focus: ${option}. Apri la bocca per confermare. Tieni gli occhi chiusi per annullare.`;
    confirmProgressBar.style.transform = `scaleX(${confirmProgress})`;
    confirmProgressBar.style.background = confirmProgressMode === 'cancel'
        ? 'linear-gradient(90deg, #ff6b6b, #ff5fa2)'
        : 'linear-gradient(90deg, #2de2e6, #ffd166)';
}

function renderChoices() {
    if (simulationCompleted) {
        choicesGrid.innerHTML = '';
        choiceButtons = [];
        return;
    }

    const question = currentQuestion();
    choicesGrid.innerHTML = question.options.map((option, index) => `
        <button class="choice-card" data-index="${index}" style="--choice-bg: ${CHOICE_THEMES[index]}; --progress: 0;">
            <div class="choice-progress"></div>
            <div class="choice-content">
                <div class="choice-letter">${OPTION_LETTERS[index]}</div>
                <div class="choice-text">${option}</div>
                <div class="choice-helper">Risposta ${OPTION_LETTERS[index]}</div>
            </div>
        </button>
    `).join('');

    choiceButtons = Array.from(choicesGrid.querySelectorAll('.choice-card'));
    choiceButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (simulationCompleted || currentState === 'answered' || currentState === 'done') {
                return;
            }

            const index = Number(button.dataset.index);
            focusedIndex = index;
            selectedIndex = currentState === 'confirm' ? index : selectedIndex;
            optionProgress = 0;
            confirmProgress = 0;
            confirmProgressMode = 'confirm';

            if (currentState === 'idle') {
                setState('focus');
                logEvent(`Focus manuale su risposta ${OPTION_LETTERS[index]}.`);
            } else if (currentState === 'preselect') {
                setState('focus');
                logEvent(`Preselezione interrotta e focus spostato su ${OPTION_LETTERS[index]}.`);
            } else if (currentState === 'confirm') {
                selectedIndex = index;
                confirmCancelEnabled = false;
                logEvent(`Safe check aggiornato manualmente sulla risposta ${OPTION_LETTERS[index]}.`);
            }

            syncChoices();
            syncConfirmCard();
        });
    });

    syncChoices();
}

function syncChoices() {
    choiceButtons.forEach((button, index) => {
        const isFocused = index === focusedIndex && ['focus', 'preselect', 'confirm'].includes(currentState);
        const isDimmed = currentState === 'confirm' && selectedIndex !== null && index !== selectedIndex;
        const isConfirmed = (currentState === 'answered' || currentState === 'done') && answerLockedIndex === index;
        const isCorrect = (currentState === 'answered' || currentState === 'done') && currentQuestion().correctIndex === index;
        const isWrong = (currentState === 'answered' || currentState === 'done')
            && answerLockedIndex === index
            && answerLockedIndex !== currentQuestion().correctIndex;

        let progress = 0;
        if (currentState === 'preselect' && index === focusedIndex) {
            progress = optionProgress;
        } else if ((currentState === 'confirm' || currentState === 'answered' || currentState === 'done')
            && index === selectedIndex) {
            progress = 1;
        }

        button.classList.toggle('is-focused', isFocused);
        button.classList.toggle('is-dimmed', isDimmed);
        button.classList.toggle('is-confirmed', isConfirmed);
        button.classList.toggle('is-correct', isCorrect);
        button.classList.toggle('is-wrong', isWrong);
        button.style.setProperty('--progress', progress.toFixed(3));
    });
}

function updateStateUI() {
    const meta = STATE_META[currentState];
    systemState.textContent = meta.label;
    systemState.style.background = meta.pill;
    phaseState.textContent = meta.phase;
    systemInstruction.textContent = meta.instruction;

    if (currentState === 'focus' && focusedIndex >= 0) {
        systemInstruction.textContent = `Risposta ${OPTION_LETTERS[focusedIndex]} in focus. Apri la bocca per continuare o chiudi gli occhi per selezionare.`;
    }

    if (currentState === 'confirm' && selectedIndex !== null) {
        systemInstruction.textContent = `Safe check sulla risposta ${OPTION_LETTERS[selectedIndex]}. Bocca per confermare, occhi per annullare.`;
    }

    if (currentState === 'done') {
        mouthCommandLabel.textContent = 'Bocca: pronta per un nuovo test';
        eyesCommandLabel.textContent = 'Occhi: nessuna azione richiesta';
    } else {
        mouthCommandLabel.textContent = currentState === 'confirm'
            ? 'Bocca: Conferma finale'
            : 'Bocca: Scroll / Attivazione';
        eyesCommandLabel.textContent = currentState === 'confirm'
            ? 'Occhi: Annulla la scelta'
            : 'Occhi: Seleziona risposta';
    }

    syncConfirmCard();
    syncChoices();
    requestStudentSnapshotSync();
}

function setState(nextState) {
    currentState = nextState;
    updateStateUI();
}

function resetTrackingFlags() {
    mouthOpenStartedAt = null;
    mouthCommandLocked = false;
    eyeHoldStartedAt = null;
    cancelHoldStartedAt = null;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
}

function resetCurrentFlow(goToStart = false) {
    if (nextQuestionTimer) {
        window.clearTimeout(nextQuestionTimer);
        nextQuestionTimer = null;
    }

    if (goToStart) {
        currentQuestionIndex = 0;
        simulationCompleted = false;
    }

    focusedIndex = -1;
    selectedIndex = null;
    answerLockedIndex = null;
    optionProgress = 0;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
    confirmCancelEnabled = false;
    resetTrackingFlags();
    updateQuestionHeader();
    renderChoices();
    setState('idle');
    setCommandState('In attesa');
}

function completeSimulation() {
    simulationCompleted = true;
    setState('done');
    updateQuestionHeader();
    renderChoices();
    setCommandState('Test completato');
    logEvent('Simulazione completata con successo.');
    speakText('Test completato. Il flusso di risposta e stato verificato.', { interrupt: true, rate: 1.02 });
}

function advanceQuestion() {
    if (currentQuestionIndex >= questionSet.length - 1) {
        completeSimulation();
        return;
    }

    currentQuestionIndex += 1;
    focusedIndex = -1;
    selectedIndex = null;
    answerLockedIndex = null;
    optionProgress = 0;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
    confirmCancelEnabled = false;
    resetTrackingFlags();
    updateQuestionHeader();
    renderChoices();
    setState('idle');
    setCommandState('In attesa');
    logEvent(`Passaggio alla ${currentQuestion().title.toLowerCase()}.`);
    speakText(`Nuova domanda pronta. ${currentQuestion().title}.`, { interrupt: true, rate: 1.04 });
}

function readCurrentQuestion() {
    if (simulationCompleted) {
        speakText('Il test e completato. Premi reset per ricominciare.', { interrupt: true, rate: 1.02 });
        return;
    }

    const question = currentQuestion();
    const optionText = question.options
        .map((option, index) => `${OPTION_LETTERS[index]} ${option}`)
        .join('. ');

    speakText(`${question.title}. ${question.prompt}. Opzioni: ${optionText}.`, {
        interrupt: true,
        rate: 1.01,
        pitch: 1.04
    });

    logEvent('Lettura vocale della domanda attivata.');
}

function beginPreselection(source) {
    if (focusedIndex < 0 || simulationCompleted) {
        return;
    }

    optionProgress = 0;
    setState('preselect');
    setCommandState('Preselezione occhi');
    logEvent(`${source}: avvio preselezione della risposta ${OPTION_LETTERS[focusedIndex]}.`);
}

function cancelPreselection(source) {
    optionProgress = 0;
    setState('focus');
    setCommandState('Preselezione annullata');
    playChime('cancel');
    logEvent(`${source}: preselezione annullata, ritorno alla navigazione.`);
}

function completePreselection(source) {
    selectedIndex = focusedIndex;
    optionProgress = 1;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
    confirmCancelEnabled = false;
    setState('confirm');
    setCommandState('Safe check attivo');
    playChime('select');
    logEvent(`${source}: risposta ${OPTION_LETTERS[selectedIndex]} catturata, safe check aperto.`);
    speakText(`Hai scelto ${OPTION_LETTERS[selectedIndex]}. ${currentQuestion().options[selectedIndex]}. Apri la bocca per confermare.`, {
        interrupt: true,
        rate: 1.04
    });
}

function cancelSelection(source) {
    selectedIndex = null;
    optionProgress = 0;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
    confirmCancelEnabled = false;
    setState('focus');
    setCommandState('Scelta annullata');
    playChime('cancel');
    logEvent(`${source}: conferma annullata, ritorno alla navigazione.`);
    speakText('Scelta annullata. Continua a scorrere le risposte.', { interrupt: true, rate: 1.04 });
}

function confirmSelection(source) {
    if (selectedIndex === null || simulationCompleted) {
        return;
    }

    answerLockedIndex = selectedIndex;
    setState('answered');
    setCommandState('Risposta registrata');
    playChime('confirm');

    const isCorrect = answerLockedIndex === currentQuestion().correctIndex;
    const feedback = isCorrect
        ? `Risposta confermata. ${OPTION_LETTERS[answerLockedIndex]}. Corretta.`
        : `Risposta confermata. ${OPTION_LETTERS[answerLockedIndex]}. Registrata.`;

    logEvent(`${source}: risposta ${OPTION_LETTERS[answerLockedIndex]} confermata.`);
    speakText(feedback, { interrupt: true, rate: 1.02 });

    nextQuestionTimer = window.setTimeout(() => {
        advanceQuestion();
    }, CONFIG.answerAdvanceDelayMs);
}

function handleScrollCommand(source) {
    if (simulationCompleted || currentState === 'answered' || currentState === 'done') {
        return;
    }

    flashCard(elMouthCard);
    playChime('scroll');

    if (currentState === 'idle') {
        focusedIndex = 0;
        optionProgress = 0;
        setState('focus');
        setCommandState('Scroll: risposta A');
        logEvent(`${source}: attivata la navigazione sulla risposta A.`);
        speakText(`Navigazione attiva. Risposta A. ${currentQuestion().options[0]}.`, {
            interrupt: true,
            rate: 1.05
        });
        return;
    }

    if (currentState === 'focus') {
        focusedIndex = (focusedIndex + 1) % currentQuestion().options.length;
        optionProgress = 0;
        setCommandState(`Scroll: risposta ${OPTION_LETTERS[focusedIndex]}`);
        syncChoices();
        logEvent(`${source}: focus spostato sulla risposta ${OPTION_LETTERS[focusedIndex]}.`);
        speakText(`${OPTION_LETTERS[focusedIndex]}. ${currentQuestion().options[focusedIndex]}.`, {
            interrupt: true,
            rate: 1.08,
            pitch: 1.05
        });
        return;
    }

    if (currentState === 'confirm') {
        confirmSelection(source);
    }
}
function processMouthState(mouthOpen) {
    const now = performance.now();

    if (!mouthOpen) {
        mouthOpenStartedAt = null;
        mouthCommandLocked = false;
        if (currentState !== 'answered' && currentState !== 'done') {
            setCommandState('In attesa');
        }
        return;
    }

    if (mouthCommandLocked) {
        return;
    }

    if (mouthOpenStartedAt === null) {
        mouthOpenStartedAt = now;
        setCommandState('Bocca rilevata');
        return;
    }

    const holdTime = now - mouthOpenStartedAt;
    if (holdTime >= CONFIG.scrollActivationMs && now - lastScrollAt >= CONFIG.scrollCooldownMs) {
        mouthCommandLocked = true;
        lastScrollAt = now;
        handleScrollCommand('Bocca');
    }
}

function processEyeState(eyesClosed) {
    const now = performance.now();

    if (currentState === 'focus' || currentState === 'preselect') {
        if (!eyesClosed) {
            if (currentState === 'preselect') {
                cancelPreselection('Occhi');
            }
            eyeHoldStartedAt = null;
            optionProgress = 0;
            syncChoices();
            return;
        }

        if (eyeHoldStartedAt === null) {
            eyeHoldStartedAt = now;
            if (currentState !== 'preselect') {
                beginPreselection('Occhi');
            }
            flashCard(elLeftEyeCard);
            flashCard(elRightEyeCard);
        }

        const progress = Math.min(1, (now - eyeHoldStartedAt) / CONFIG.selectHoldMs);
        optionProgress = progress;
        syncChoices();
        setCommandState(`Selezione in carico ${Math.round(progress * 100)}%`);

        if (progress >= 1) {
            eyeHoldStartedAt = null;
            completePreselection('Occhi');
        }

        return;
    }

    if (currentState !== 'confirm') {
        cancelHoldStartedAt = null;
        confirmProgress = 0;
        syncConfirmCard();
        return;
    }

    if (!confirmCancelEnabled) {
        if (!eyesClosed) {
            confirmCancelEnabled = true;
            confirmProgress = 0;
            syncConfirmCard();
        }
        return;
    }

    if (!eyesClosed) {
        cancelHoldStartedAt = null;
        confirmProgress = 0;
        confirmProgressMode = 'confirm';
        syncConfirmCard();
        return;
    }

    if (cancelHoldStartedAt === null) {
        cancelHoldStartedAt = now;
        confirmProgressMode = 'cancel';
        setCommandState('Annullamento in carico');
        flashCard(elLeftEyeCard);
        flashCard(elRightEyeCard);
    }

    const progress = Math.min(1, (now - cancelHoldStartedAt) / CONFIG.selectHoldMs);
    confirmProgress = progress;
    syncConfirmCard();

    if (progress >= 1) {
        cancelHoldStartedAt = null;
        cancelSelection('Occhi');
    }
}

function updateChoiceMachine(leftEar, rightEar, mar, faceDetected) {
    const averageEar = (leftEar + rightEar) / 2;
    avgEarValue.textContent = averageEar.toFixed(3);
    liveMarValue.textContent = mar.toFixed(3);

    if (!faceDetected) {
        setCommandState(isRunning ? 'Volto non rilevato' : 'In attesa');
        mouthOpenStartedAt = null;
        eyeHoldStartedAt = null;
        cancelHoldStartedAt = null;
        if (currentState === 'preselect') {
            cancelPreselection('Tracking');
        }
        return;
    }

    if (manualLock) {
        return;
    }

    const eyesClosed = leftEar < EAR_THRESHOLD && rightEar < EAR_THRESHOLD;
    const mouthOpen = mar > MAR_THRESHOLD;

    processMouthState(mouthOpen);
    processEyeState(eyesClosed);
}

function updateZoomCanvas(landmarks, sourceImage) {
    const width = zoomCanvas.width;
    const height = zoomCanvas.height;

    zoomCtx.fillStyle = '#040913';
    zoomCtx.fillRect(0, 0, width, height);

    if (!landmarks || !sourceImage) {
        return;
    }

    const drawEye = (eyeIndices, xOffset, color) => {
        let minX = 1;
        let minY = 1;
        let maxX = 0;
        let maxY = 0;

        eyeIndices.forEach((index) => {
            const point = landmarks[index];
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });

        const padX = (maxX - minX) * 0.6;
        const padY = (maxY - minY) * 1.4;
        const srcX = Math.max(0, (minX - padX) * sourceImage.width);
        const srcY = Math.max(0, (minY - padY) * sourceImage.height);
        const srcW = Math.min(sourceImage.width - srcX, (maxX - minX + padX * 2) * sourceImage.width);
        const srcH = Math.min(sourceImage.height - srcY, (maxY - minY + padY * 2) * sourceImage.height);

        zoomCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, xOffset, 0, width / 2, height);

        const eyeWidth = width / 2;
        const scaleX = eyeWidth / srcW;
        const scaleY = height / srcH;
        zoomCtx.fillStyle = color;

        eyeIndices.forEach((index) => {
            const point = landmarks[index];
            const px = (point.x * sourceImage.width - srcX) * scaleX + xOffset;
            const py = (point.y * sourceImage.height - srcY) * scaleY;
            zoomCtx.beginPath();
            zoomCtx.arc(px, py, 2.4, 0, Math.PI * 2);
            zoomCtx.fill();
        });

        zoomCtx.strokeStyle = color;
        zoomCtx.lineWidth = 2;
        zoomCtx.strokeRect(xOffset + 1, 1, width / 2 - 2, height - 2);
    };

    drawEye(RIGHT_EYE, 0, '#ff6b6b');
    drawEye(LEFT_EYE, width / 2, '#2de2e6');
}

function onResults(results) {
    canvasCtx.save();
    canvasCtx.fillStyle = '#08111f';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        loadingOverlay.classList.remove('active');
        const landmarks = results.multiFaceLandmarks[0];

        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#ff7b7b', lineWidth: 2 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#2de2e6', lineWidth: 2 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, { color: '#ffd166', lineWidth: 2 });

        let rightEar = calculateEAR(RIGHT_EYE, landmarks);
        let leftEar = calculateEAR(LEFT_EYE, landmarks);
        if (isGlassesMode) {
            rightEar = smoothValue(rightEar, rightEarBuffer);
            leftEar = smoothValue(leftEar, leftEarBuffer);
        }

        const mar = calculateMAR(landmarks);
        latestEarRight = rightEar;
        latestEarLeft = leftEar;
        latestMar = mar;

        updateSensorCard(elRightEyeCard, elRightEyeStatus, elRightEyeEar, rightEar, EAR_THRESHOLD, 'eye');
        updateSensorCard(elLeftEyeCard, elLeftEyeStatus, elLeftEyeEar, leftEar, EAR_THRESHOLD, 'eye');
        updateSensorCard(elMouthCard, elMouthStatus, elMouthMar, mar, MAR_THRESHOLD, 'mouth');
        updateZoomCanvas(landmarks, results.image);
        updateChoiceMachine(leftEar, rightEar, mar, true);
    } else {
        updateZoomCanvas(null, null);
        updateChoiceMachine(latestEarLeft, latestEarRight, latestMar, false);
    }

    canvasCtx.restore();
}

const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

async function startCamera() {
    if (isRunning) {
        return;
    }

    ensureAudioContext();
    loadingOverlay.classList.add('active');
    cameraState.textContent = 'Avvio webcam in corso';
    startBtn.disabled = true;
    startBtn.textContent = 'Avvio webcam...';

    try {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });

        await camera.start();
        isRunning = true;
        cameraState.textContent = 'Webcam attiva e tracking pronto';
        startBtn.textContent = 'Webcam attiva';
        logEvent('Webcam attivata correttamente.');
        speakText('Webcam attiva. Il sistema e pronto per il test.', { interrupt: true, rate: 1.03 });
    } catch (error) {
        console.error('Errore webcam:', error);
        cameraState.textContent = 'Errore accesso webcam';
        startBtn.disabled = false;
        startBtn.textContent = 'Riprova webcam';
        loadingOverlay.classList.remove('active');
        logEvent('Errore nell accesso alla webcam.');
        alert('Impossibile accedere alla webcam. Verifica i permessi del browser.');
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}
async function simulateEyeHold(mode, source) {
    if (manualLock || simulationCompleted) {
        return;
    }

    if (mode === 'select' && currentState !== 'focus') {
        logEvent('Simulazione occhi ignorata: nessuna risposta in focus.');
        return;
    }

    if (mode === 'cancel' && currentState !== 'confirm') {
        logEvent('Simulazione annullamento ignorata: safe check non attivo.');
        return;
    }

    manualLock = true;
    ensureAudioContext();

    if (mode === 'select') {
        beginPreselection(source);
    } else {
        confirmCancelEnabled = true;
        confirmProgressMode = 'cancel';
        setCommandState('Annullamento simulato');
        logEvent(`${source}: avvio annullamento simulato.`);
    }

    const start = performance.now();
    while (performance.now() - start < CONFIG.selectHoldMs) {
        const progress = Math.min(1, (performance.now() - start) / CONFIG.selectHoldMs);
        if (mode === 'select') {
            optionProgress = progress;
            syncChoices();
        } else {
            confirmProgress = progress;
            syncConfirmCard();
        }
        await sleep(40);
    }

    if (mode === 'select') {
        completePreselection(source);
    } else {
        cancelSelection(source);
    }

    manualLock = false;
}

async function runAutomaticDemo() {
    if (demoRunning) {
        return;
    }

    demoRunning = true;
    manualLock = false;
    resetCurrentFlow(true);
    ensureAudioContext();
    logEvent('Avvio demo automatica del processo Kahoot.');
    speakText('Avvio demo automatica del processo di risposta.', { interrupt: true, rate: 1.02 });

    await sleep(650);
    readCurrentQuestion();
    await sleep(3200);
    handleScrollCommand('Demo automatica');
    await sleep(1250);
    handleScrollCommand('Demo automatica');
    await sleep(1250);
    await simulateEyeHold('select', 'Demo automatica');
    await sleep(1200);
    handleScrollCommand('Demo automatica');
    await sleep(CONFIG.answerAdvanceDelayMs + 400);

    demoRunning = false;
}

startBtn.addEventListener('click', startCamera);
readQuestionBtn.addEventListener('click', () => {
    ensureAudioContext();
    readCurrentQuestion();
});

simulateScrollBtn.addEventListener('click', () => {
    ensureAudioContext();
    handleScrollCommand('Simulazione bocca');
});

simulateSelectBtn.addEventListener('click', async () => {
    ensureAudioContext();
    if (currentState === 'confirm') {
        await simulateEyeHold('cancel', 'Simulazione occhi');
        return;
    }
    await simulateEyeHold('select', 'Simulazione occhi');
});

simulateConfirmBtn.addEventListener('click', () => {
    ensureAudioContext();
    if (currentState !== 'confirm') {
        logEvent('Conferma simulata ignorata: safe check non attivo.');
        return;
    }
    confirmSelection('Simulazione conferma');
});

runDemoBtn.addEventListener('click', runAutomaticDemo);
resetFlowBtn.addEventListener('click', () => {
    resetCurrentFlow(true);
    logEvent('Reset completo della simulazione.');
    speakText('Simulazione resettata. Pronto per un nuovo test.', { interrupt: true, rate: 1.03 });
});

questionFileInput.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        return;
    }

    try {
        const questions = await parseQuestionFile(file);
        applyImportedQuestions(questions, file.name);
    } catch (error) {
        console.error('Errore importazione test:', error);
        updateImportStatus(`Errore import: ${error.message}`, true);
        logEvent(`Import fallito: ${error.message}`);
        alert(`File non valido: ${error.message}`);
    } finally {
        questionFileInput.value = '';
    }
});

downloadCsvTemplateBtn.addEventListener('click', () => {
    downloadTextFile('template-test.csv', createCsvTemplate(), 'text/csv;charset=utf-8');
    updateImportStatus('Template CSV scaricato');
});

downloadJsonTemplateBtn.addEventListener('click', () => {
    downloadTextFile('template-test.json', createJsonTemplate(), 'application/json;charset=utf-8');
    updateImportStatus('Template JSON scaricato');
});

restoreDefaultQuestionsBtn.addEventListener('click', () => {
    questionSet = cloneQuestionSet(DEFAULT_QUESTION_SET);
    resetCurrentFlow(true);
    updateImportStatus('Ripristinato il test base incluso nel programma');
    logEvent('Ripristinate le domande base del progetto.');
});

window.addEventListener('beforeunload', () => {
    if (remoteStateTimer) {
        window.clearInterval(remoteStateTimer);
    }
    if (remoteCommandTimer) {
        window.clearInterval(remoteCommandTimer);
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
});

if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
        getItalianVoice();
    });
}

resetCurrentFlow(true);
logEvent('Profilo calibrato caricato: EAR 0.13, MAR 0.17, occhiali attivi.');
setCommandState('In attesa');
startRemoteSync();










