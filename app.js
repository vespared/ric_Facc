const CONFIG = {
    earThreshold: 0.13,
    marThreshold: 0.17,
    glassesMode: true,
    earBufferSize: 15,
    scrollActivationMs: 300,
    scrollCooldownMs: 1000,
    selectHoldMs: 1000,
    answerAdvanceDelayMs: 5200,
    answerFeedbackVisibleMs: 4600,
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
        title: 'Domanda 1 (4 scelte)',
        prompt: 'Quale pianeta del nostro sistema solare e conosciuto come il Pianeta Rosso?',
        options: [
            'Marte',
            'Giove',
            'Venere',
            'Nettuno'
        ],
        correctIndex: 0
    },
    {
        title: 'Domanda 2 (3 scelte)',
        prompt: 'Quale fra questi e uno stato fisico fondamentale della materia?',
        options: [
            'Solido',
            'Elettrico',
            'Magnetico'
        ],
        correctIndex: 0
    },
    {
        title: 'Domanda 3 (2 scelte)',
        prompt: 'Il Sole e una stella situata al centro del nostro sistema planetario?',
        options: [
            'Vero',
            'Falso'
        ],
        correctIndex: 0
    }
];

let questionSet = cloneQuestionSet(DEFAULT_QUESTION_SET);

let currentQuizSession = {
    id: `quiz_${Date.now()}`,
    student: 'Martinelli',
    subject: 'Italiano',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'in_corso',
    answers: [],
    score: { esatte: 0, errate: 0, libere: 0, totaleRisposte: 0, percentuale: 0 },
    fileName: null
};

function recalculateSessionScore() {
    let esatte = 0;
    let errate = 0;
    let libere = 0;
    const answered = currentQuizSession.answers.filter(Boolean);
    answered.forEach((a) => {
        if (a.outcome === 'correct' || a.isCorrect === true) {
            esatte++;
        } else if (a.outcome === 'wrong' || a.isCorrect === false) {
            errate++;
        } else {
            libere++;
        }
    });
    const totaleRisposte = answered.length;
    const totaleDomande = questionSet.length || 1;
    const percentuale = Math.round((esatte / totaleDomande) * 100);
    currentQuizSession.score = {
        esatte,
        errate,
        libere,
        totaleRisposte,
        percentuale
    };
    return currentQuizSession.score;
}

function initQuizSession(subject, questions) {
    currentQuizSession.id = `quiz_${Date.now()}`;
    currentQuizSession.subject = subject || currentQuizSession.subject || 'Italiano';
    currentQuizSession.startedAt = new Date().toISOString();
    currentQuizSession.updatedAt = new Date().toISOString();
    currentQuizSession.answers = [];
    currentQuizSession.fileName = null;
    currentQuizSession.status = 'in_corso';
    recalculateSessionScore();
}

async function savePartialQuizSession() {
    if (!currentQuizSession.startedAt) {
        currentQuizSession.startedAt = new Date().toISOString();
    }
    currentQuizSession.updatedAt = new Date().toISOString();

    const payload = {
        id: currentQuizSession.id,
        student: currentQuizSession.student,
        subject: currentQuizSession.subject,
        startedAt: currentQuizSession.startedAt,
        fileName: currentQuizSession.fileName,
        currentQuestionIndex: currentQuestionIndex,
        totaleDomande: questionSet.length,
        domandeCompletate: currentQuizSession.answers.filter(Boolean).length,
        score: currentQuizSession.score,
        questions: questionSet,
        answers: currentQuizSession.answers
    };

    try {
        const res = await fetchJson('/api/quiz/save-partial', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (res && res.session) {
            currentQuizSession.id = res.session.id;
            currentQuizSession.fileName = res.session.fileName;
        }
    } catch (e) {
        try {
            localStorage.setItem('ric_facc_partial_quiz', JSON.stringify(payload));
        } catch (err) {}
    }
}

async function saveTotalQuizSession() {
    currentQuizSession.status = 'completato';
    currentQuizSession.updatedAt = new Date().toISOString();

    const payload = {
        id: currentQuizSession.id,
        student: currentQuizSession.student,
        subject: currentQuizSession.subject,
        startedAt: currentQuizSession.startedAt,
        fileName: currentQuizSession.fileName,
        currentQuestionIndex: questionSet.length,
        totaleDomande: questionSet.length,
        domandeCompletate: currentQuizSession.answers.filter(Boolean).length,
        score: currentQuizSession.score,
        questions: questionSet,
        answers: currentQuizSession.answers
    };

    try {
        const res = await fetchJson('/api/quiz/save-total', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (res && res.session) {
            currentQuizSession.fileName = res.session.fileName;
            currentQuizSession.schedaReport = res.session.schedaReport;
            logEvent(`Risultato totale salvato per ${currentQuizSession.student}: ${res.session.fileName}`);
        }
        try {
            localStorage.removeItem('ric_facc_partial_quiz');
        } catch (err) {}
    } catch (e) {
        console.error('Errore salvataggio totale:', e);
    }
}

function resumeQuizSession(session) {
    if (!session || !Array.isArray(session.domande) || session.domande.length === 0) {
        return;
    }
    questionSet = cloneQuestionSet(session.domande);
    setQuestionFileGate(false);
    currentQuizSession.id = session.id;
    currentQuizSession.student = session.studente || currentQuizSession.student;
    currentQuizSession.subject = session.materia || currentQuizSession.subject;
    currentQuizSession.startedAt = session.dataIso || new Date().toISOString();
    currentQuizSession.answers = Array.isArray(session.answers) ? [...session.answers] : [];
    currentQuizSession.fileName = session.fileName;
    currentQuizSession.status = 'in_corso';

    let targetIndex = Number(session.currentQuestionIndex || 0);
    if (currentQuizSession.answers[targetIndex] && targetIndex < questionSet.length - 1) {
        const nextUnanswered = questionSet.findIndex((_, idx) => !currentQuizSession.answers[idx]);
        if (nextUnanswered >= 0) {
            targetIndex = nextUnanswered;
        }
    }
    targetIndex = Math.max(0, Math.min(targetIndex, questionSet.length - 1));

    simulationCompleted = false;
    currentQuestionIndex = targetIndex;
    recalculateSessionScore();
    resetCurrentFlow(false);

    hideSuspendedBanner();
    logEvent(`Ripreso test in corso di ${currentQuizSession.subject} alla domanda ${currentQuestionIndex + 1}.`);
    speakText(`Test di ${currentQuizSession.subject} ripreso alla ${currentQuestion().title}.`, { interrupt: true, rate: 1.02 });
}

function restartQuizSession(session) {
    if (!session || !Array.isArray(session.domande) || session.domande.length === 0) {
        return;
    }
    questionSet = cloneQuestionSet(session.domande);
    setQuestionFileGate(false);
    currentQuizSession.id = `quiz_${Date.now()}`;
    currentQuizSession.student = session.studente || currentQuizSession.student;
    currentQuizSession.subject = session.materia || currentQuizSession.subject;
    currentQuizSession.startedAt = new Date().toISOString();
    currentQuizSession.answers = [];
    currentQuizSession.fileName = null;
    currentQuizSession.status = 'in_corso';

    simulationCompleted = false;
    currentQuestionIndex = 0;
    recalculateSessionScore();
    resetCurrentFlow(false);

    hideSuspendedBanner();
    logEvent(`Riavviato test di ${currentQuizSession.subject} dalla prima domanda.`);
    speakText(`Test di ${currentQuizSession.subject} riavviato dall'inizio. ${currentQuestion().title}.`, { interrupt: true, rate: 1.02 });
    void savePartialQuizSession();
}

function hideSuspendedBanner() {
    const modal = document.getElementById('studentSuspendedModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}


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
let cameraWasRunningBeforePresentation = false;
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
let examStarted = true;
// Il quiz resta bloccato dietro la schermata iniziale finche non viene caricato un file di domande.
let awaitingQuestionFile = true;
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
const instructionBar = document.querySelector('.instruction-bar');
const questionCard = document.querySelector('.question-card');
const questionText = document.getElementById('questionText');
const questionMedia = document.getElementById('questionMedia');
const questionImage = document.getElementById('questionImage');
const questionImageFallback = document.getElementById('questionImageFallback');
const systemState = document.getElementById('systemState');
const systemInstruction = document.getElementById('systemInstruction');
const mouthCommandLabel = document.getElementById('mouthCommandLabel');
const eyesCommandLabel = document.getElementById('eyesCommandLabel');
const choicesGrid = document.getElementById('choicesGrid');
const confirmCard = document.getElementById('confirmCard');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmProgressBar = document.getElementById('confirmProgressBar');
const quizCardStudent = document.querySelector('.quiz-card--student');
const answerFeedback = document.getElementById('answerFeedback');
const answerFeedbackBadge = document.getElementById('answerFeedbackBadge');
const answerFeedbackTitle = document.getElementById('answerFeedbackTitle');
const answerFeedbackSubtitle = document.getElementById('answerFeedbackSubtitle');
const answerFeedbackParticles = document.getElementById('answerFeedbackParticles');
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
const questionFileGate = document.getElementById('questionFileGate');
const gateLoadFileBtn = document.getElementById('gateLoadFileBtn');
const gateFileInput = document.getElementById('gateFileInput');
const gateFileStatus = document.getElementById('gateFileStatus');
const gateCameraPicker = document.getElementById('gateCameraPicker');

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];
const MOUTH_LANDMARKS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 78, 308, 13, 14];
const FRAMING_MARGIN = 0.05;
const FRAMING_FACE_MIN = 0.18;
const FRAMING_FACE_MAX = 0.95;
const REMOTE_SYNC_ENABLED = window.location.protocol === 'http:' || window.location.protocol === 'https:';
const DEBUG_CHANNEL_NAME = 'ric-facc-student-debug';
const DEBUG_STORAGE_KEY = 'ricFaccDebugSnapshot';
const DEBUG_FRAME_INTERVAL_MS = 350;
const REMOTE_DEBUG_FRAME_INTERVAL_MS = 700;

let remoteStatePushInFlight = false;
let remoteStatePushQueued = false;
let remoteStateNeedsFrames = false;
let remoteCommandPollInFlight = false;
let remoteLastCommandId = null;
let remoteStateTimer = null;
let remoteCommandTimer = null;
let debugChannel = null;
let debugLastFrameAt = 0;
let remoteLastFrameAt = 0;
let lastFaceDetected = false;
let activeReadingSequenceId = 0;
let remoteLastAckedCommandId = 0;
let latestFraming = createEmptyFraming(false);

const remoteEventHistory = [];

function currentQuestion() {
    return questionSet[currentQuestionIndex];
}

// Domanda a scelta libera (survey / comunicazione): solo se priva di risposta esatta definita.
function isFreeChoiceQuestion() {
    const question = currentQuestion();
    if (!question) return false;
    return question.freeChoice === true || question.correctIndex === null || question.correctIndex === undefined || question.correctIndex < 0;
}

function createEmptyFraming(cameraRunning) {
    return {
        cameraRunning: Boolean(cameraRunning),
        faceDetected: false,
        margin: FRAMING_MARGIN,
        faceBox: null,
        faceWidth: 0,
        faceHeight: 0,
        features: {
            leftEye: { present: false, withinFrame: false, center: null, bbox: null },
            rightEye: { present: false, withinFrame: false, center: null, bbox: null },
            mouth: { present: false, withinFrame: false, center: null, bbox: null }
        },
        overall: cameraRunning ? 'no-face' : 'inactive',
        message: cameraRunning
            ? 'Volto non rilevato dalla webcam.'
            : 'Webcam non avviata sul PC.'
    };
}

function landmarkBoundingBox(landmarks, indices) {
    if (!landmarks || !indices || indices.length === 0) {
        return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;

    for (const index of indices) {
        const point = landmarks[index];
        if (!point) {
            continue;
        }
        const x = Number(point.x);
        const y = Number(point.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
        }
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        count += 1;
    }

    if (count === 0) {
        return null;
    }
    return {
        minX: Number(minX.toFixed(4)),
        minY: Number(minY.toFixed(4)),
        maxX: Number(maxX.toFixed(4)),
        maxY: Number(maxY.toFixed(4))
    };
}

function bboxCenter(box) {
    if (!box) return null;
    return {
        x: Number(((box.minX + box.maxX) / 2).toFixed(4)),
        y: Number(((box.minY + box.maxY) / 2).toFixed(4))
    };
}

function bboxWithinFrame(box, margin) {
    if (!box) return false;
    return box.minX >= margin
        && box.minY >= margin
        && box.maxX <= 1 - margin
        && box.maxY <= 1 - margin;
}

function buildFeatureFraming(landmarks, indices, margin) {
    const bbox = landmarkBoundingBox(landmarks, indices);
    if (!bbox) {
        return { present: false, withinFrame: false, center: null, bbox: null };
    }
    return {
        present: true,
        withinFrame: bboxWithinFrame(bbox, margin),
        center: bboxCenter(bbox),
        bbox
    };
}

function computeFramingFromLandmarks(landmarks, cameraRunning) {
    if (!landmarks || landmarks.length === 0) {
        return createEmptyFraming(cameraRunning);
    }

    const margin = FRAMING_MARGIN;
    const allIndices = landmarks.map((_, index) => index);
    const faceBox = landmarkBoundingBox(landmarks, allIndices);
    const faceWidth = faceBox ? Number((faceBox.maxX - faceBox.minX).toFixed(4)) : 0;
    const faceHeight = faceBox ? Number((faceBox.maxY - faceBox.minY).toFixed(4)) : 0;

    const features = {
        leftEye: buildFeatureFraming(landmarks, LEFT_EYE, margin),
        rightEye: buildFeatureFraming(landmarks, RIGHT_EYE, margin),
        mouth: buildFeatureFraming(landmarks, MOUTH_LANDMARKS, margin)
    };

    const featureValues = Object.values(features);
    const missing = featureValues.filter((feature) => !feature.present).length;
    const outOfFrame = featureValues.filter((feature) => feature.present && !feature.withinFrame).length;
    const tooSmall = faceWidth > 0 && faceWidth < FRAMING_FACE_MIN;
    const tooClose = faceWidth > FRAMING_FACE_MAX;

    let overall = 'ok';
    let message = 'Inquadratura corretta: occhi e bocca ben visibili.';

    if (missing > 0) {
        overall = 'error';
        message = 'Alcuni tratti del viso non sono rilevati: chiedi al ragazzo di riposizionarsi davanti alla webcam.';
    } else if (outOfFrame > 0) {
        overall = 'error';
        message = 'Occhi o bocca troppo vicini al bordo del frame: centra meglio il viso nella webcam.';
    } else if (tooSmall) {
        overall = 'warning';
        message = 'Il viso e troppo lontano dalla webcam: avvicinati di qualche centimetro.';
    } else if (tooClose) {
        overall = 'warning';
        message = 'Il viso e troppo vicino alla webcam: allontanati di qualche centimetro.';
    }

    return {
        cameraRunning: Boolean(cameraRunning),
        faceDetected: true,
        margin,
        faceBox,
        faceWidth,
        faceHeight,
        features,
        overall,
        message
    };
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

    throw new Error(`Domanda ${questionIndex + 1}: risposta corretta "${value}" non valida per ${options.length} opzioni disponibili.`);
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

    const correctIndex = resolveCorrectIndex(
        rawQuestion.correctIndex ?? rawQuestion.correct ?? rawQuestion.corretta ?? rawQuestion.rispostaesatta ?? rawQuestion.rispostacorretta ?? rawQuestion.esatta ?? rawQuestion.answer ?? rawQuestion.risposta ?? rawQuestion.soluzione,
        options,
        index
    );

    const image = RicFaccImages.readQuestionImage(rawQuestion);

    return {
        title,
        prompt,
        options,
        correctIndex,
        ...(image ? { image } : {})
    };
}

function updateImportStatus(message, isError = false) {
    importStatus.textContent = message;
    importStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function setGateFileStatus(message, isError = false) {
    if (!gateFileStatus) {
        return;
    }
    gateFileStatus.textContent = message;
    gateFileStatus.classList.toggle('is-error', isError);
}

// Blocca (true) o sblocca (false) l'accesso al quiz dietro la schermata iniziale.
function setQuestionFileGate(locked) {
    awaitingQuestionFile = locked;
    if (!questionFileGate) {
        return;
    }

    questionFileGate.classList.toggle('exam-gate--hidden', !locked);
    questionFileGate.setAttribute('aria-hidden', String(!locked));
    questionFileGate.toggleAttribute('inert', !locked);

    if (locked) {
        setGateFileStatus('Nessun file caricato.');
        if (gateLoadFileBtn) {
            gateLoadFileBtn.focus();
        }
    }
}

function setRemoteSyncStatus(message, isError = false) {
    if (!remoteSyncStatus) {
        return;
    }
    remoteSyncStatus.textContent = message;
    remoteSyncStatus.style.color = isError ? 'var(--red)' : 'var(--muted)';
    publishDebugSnapshot(false);
}

function updateTeacherUrlHint() {
    if (!teacherUrlHint) {
        return;
    }

    teacherUrlHint.textContent = REMOTE_SYNC_ENABLED
        ? `Pannello docente: ${window.location.origin}/teacher.html`
        : 'Pannello docente disponibile avviando server.js e aprendo il quiz via http://localhost:3000';
    publishDebugSnapshot(false);
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

async function acknowledgeRemoteCommand(command, status, message) {
    const response = await fetchJson('/api/command-ack', {
        method: 'POST',
        body: JSON.stringify({
            id: command.id,
            type: command.type,
            status,
            message
        })
    });

    remoteLastAckedCommandId = Math.max(remoteLastAckedCommandId, Number(response.ackedCommandId || 0));
    remoteLastCommandId = Math.max(remoteLastCommandId || 0, remoteLastAckedCommandId);
}

function captureDebugFrames() {
    try {
        return {
            tracking: canvasElement.toDataURL('image/webp', 0.62),
            zoom: zoomCanvas.toDataURL('image/webp', 0.62)
        };
    } catch (error) {
        return null;
    }
}

function buildStudentSnapshot(includeFrames = false) {
    const question = simulationCompleted || awaitingQuestionFile ? null : currentQuestion();
    const snapshot = {
        isRunning,
        cameraState: cameraState.textContent,
        awaitingQuestionFile,
        currentState,
        phaseLabel: awaitingQuestionFile ? 'In attesa del file domande' : phaseState.textContent,
        commandLabel: commandState.textContent,
        currentQuestionIndex,
        questionCount: awaitingQuestionFile ? 0 : questionSet.length,
        simulationCompleted,
        focusedIndex,
        selectedIndex,
        answerLockedIndex,
        questionCounterLabel: awaitingQuestionFile
            ? '- / -'
            : `${Math.min(currentQuestionIndex + 1, questionSet.length)} / ${questionSet.length}`,
        faceDetected: lastFaceDetected,
        metrics: {
            leftEar: Number(latestEarLeft.toFixed(3)),
            rightEar: Number(latestEarRight.toFixed(3)),
            averageEar: Number((((latestEarLeft + latestEarRight) / 2) || 0).toFixed(3)),
            mar: Number(latestMar.toFixed(3))
        },
        sensors: {
            leftEye: {
                value: Number(latestEarLeft.toFixed(3)),
                threshold: EAR_THRESHOLD,
                status: elLeftEyeStatus.textContent,
                isOpen: latestEarLeft > EAR_THRESHOLD
            },
            rightEye: {
                value: Number(latestEarRight.toFixed(3)),
                threshold: EAR_THRESHOLD,
                status: elRightEyeStatus.textContent,
                isOpen: latestEarRight > EAR_THRESHOLD
            },
            mouth: {
                value: Number(latestMar.toFixed(3)),
                threshold: MAR_THRESHOLD,
                status: elMouthStatus.textContent,
                isOpen: latestMar > MAR_THRESHOLD
            }
        },
        thresholds: {
            ear: EAR_THRESHOLD,
            mar: MAR_THRESHOLD,
            glassesMode: isGlassesMode
        },
        framing: latestFraming,
        currentQuestion: question ? {
            title: question.title,
            prompt: question.prompt,
            options: [...question.options],
            correctIndex: question.correctIndex,
            // Le immagini incorporate (data URI) non viaggiano nello snapshot: sarebbero troppo pesanti.
            image: question.image && !question.image.startsWith('data:') ? question.image : '',
            hasImage: Boolean(question.image)
        } : null,
        events: remoteEventHistory.slice(0, CONFIG.eventLogSize),
        remote: {
            status: remoteSyncStatus ? remoteSyncStatus.textContent : '',
            teacherUrl: teacherUrlHint ? teacherUrlHint.textContent : ''
        },
        quizSession: {
            id: currentQuizSession.id,
            student: currentQuizSession.student,
            subject: currentQuizSession.subject,
            status: currentQuizSession.status,
            startedAt: currentQuizSession.startedAt,
            answersCount: currentQuizSession.answers.filter(Boolean).length,
            score: currentQuizSession.score,
            fileName: currentQuizSession.fileName
        },
        questionnaire: {
            student: currentQuizSession.student || 'Martinelli',
            subject: currentQuizSession.subject || 'Italiano',
            totaleDomande: questionSet.length,
            currentIndex: currentQuestionIndex,
            status: currentQuizSession.status,
            questions: (questionSet || []).map((q, idx) => ({
                id: q.id || (idx + 1),
                title: q.title || `Domanda ${idx + 1}`,
                prompt: q.prompt || '',
                options: Array.isArray(q.options) ? [...q.options] : [],
                correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                correctLetter: ['A', 'B', 'C', 'D'][q.correctIndex] || 'A',
                image: q.image && !q.image.startsWith('data:') ? q.image : ''
            })),
            answers: (currentQuizSession.answers || []).map((ans) => ans ? {
                questionIndex: ans.questionIndex,
                chosenIndex: ans.chosenIndex,
                chosenLetter: ans.chosenLetter,
                isCorrect: ans.isCorrect,
                outcome: ans.outcome
            } : null)
        },
        updatedAt: new Date().toISOString()
    };

    if (includeFrames) {
        snapshot.frames = captureDebugFrames();
    }

    return snapshot;
}

function buildDebugSnapshot(includeFrames = false) {
    return buildStudentSnapshot(includeFrames);
}

function persistDebugSnapshot(snapshot) {
    try {
        const previousRawSnapshot = localStorage.getItem(DEBUG_STORAGE_KEY);
        const previousSnapshot = previousRawSnapshot ? JSON.parse(previousRawSnapshot) : null;
        const storableSnapshot = { ...snapshot };

        if (!storableSnapshot.frames && previousSnapshot && previousSnapshot.frames) {
            storableSnapshot.frames = previousSnapshot.frames;
        }

        localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(storableSnapshot));
    } catch (error) {
        console.warn('Impossibile salvare lo snapshot debug locale.', error);
    }
}

function publishDebugSnapshot(includeFrames = false, force = false) {
    const now = Date.now();
    if (includeFrames && !force && now - debugLastFrameAt < DEBUG_FRAME_INTERVAL_MS) {
        return;
    }

    const snapshot = buildDebugSnapshot(includeFrames);
    persistDebugSnapshot(snapshot);

    if (includeFrames) {
        debugLastFrameAt = now;
    }

    if (debugChannel) {
        debugChannel.postMessage({
            type: 'student-debug-snapshot',
            snapshot
        });
    }
}

function dispatchDebugAction(action) {
    switch (action) {
        case 'start-camera':
            void startCamera();
            break;
        case 'read-question':
            ensureAudioContext();
            readCurrentQuestion();
            break;
        case 'simulate-scroll':
            ensureAudioContext();
            handleScrollCommand('Debug sviluppatore');
            break;
        case 'simulate-select':
            ensureAudioContext();
            if (currentState === 'confirm') {
                void simulateEyeHold('cancel', 'Debug sviluppatore');
            } else {
                void simulateEyeHold('select', 'Debug sviluppatore');
            }
            break;
        case 'simulate-confirm':
            ensureAudioContext();
            if (currentState === 'confirm') {
                confirmSelection('Debug sviluppatore');
            } else {
                logEvent('Conferma da debug ignorata: safe check non attivo.');
            }
            break;
        case 'run-demo':
            ensureAudioContext();
            void runAutomaticDemo();
            break;
        case 'reset-flow':
            resetCurrentFlow(true);
            logEvent('Reset completo richiesto dalla sessione sviluppatore.');
            speakText('Simulazione resettata dalla sessione sviluppatore.', { interrupt: true, rate: 1.03 });
            break;
        default:
            break;
    }
}

function setupDebugBridge() {
    if (!('BroadcastChannel' in window)) {
        publishDebugSnapshot(false, true);
        return;
    }

    debugChannel = new BroadcastChannel(DEBUG_CHANNEL_NAME);
    debugChannel.addEventListener('message', (event) => {
        const payload = event.data || {};
        if (payload.type === 'debug-request-sync') {
            publishDebugSnapshot(true, true);
            return;
        }
        if (payload.type === 'debug-action' && payload.action) {
            dispatchDebugAction(payload.action);
        }
    });

    publishDebugSnapshot(false, true);
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
    const includeFrames = remoteStateNeedsFrames;
    remoteStateNeedsFrames = false;

    try {
        await fetchJson('/api/student-state', {
            method: 'POST',
            body: JSON.stringify(buildStudentSnapshot(includeFrames))
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

function requestStudentSnapshotSync(includeFrames = false) {
    publishDebugSnapshot(false);
    if (!REMOTE_SYNC_ENABLED) {
        return;
    }
    remoteStateNeedsFrames = remoteStateNeedsFrames || includeFrames;
    remoteStatePushQueued = true;
    void pushStudentSnapshot();
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
        correct,
        image: RicFaccImages.readQuestionImage(normalizedRow)
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
    const imageIndex = findColumn(RicFaccImages.IMAGE_KEYS);

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
            correct: correctIndex >= 0 ? columns[correctIndex] : null,
            image: imageIndex >= 0 ? columns[imageIndex] : ''
        }, rowIndex);
    });
}

// Le immagini incorporate nel foglio (anche piu d'una per file) sono salvate sul server e collegate alla domanda
// della stessa riga. Gli eventuali avvisi viaggiano sull'array restituito (imageWarnings).
async function parseXlsxQuestions(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Libreria Excel non disponibile nel browser.');
    }

    const workbook = XLSX.read(arrayBuffer, { type: 'array', bookFiles: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        throw new Error('Il file XLSX non contiene fogli leggibili.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) {
        throw new Error('Il file XLSX non contiene righe di domande.');
    }

    const questions = rows.map((row, index) => mapRowToQuestion(row, index));
    const { warnings } = await RicFaccImages.attachWorkbookImages(workbook, firstSheetName, rows, questions);
    questions.imageWarnings = warnings;
    return questions;
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
            } else if (RicFaccImages.IMAGE_KEYS.includes(key)) {
                rawQuestion.image = value;
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
    const questions = await readQuestionsFromFile(file);
    const missingImages = await RicFaccImages.findMissingImages(questions);
    questions.imageWarnings = [...(questions.imageWarnings || []), ...missingImages];
    return questions;
}

// Riepilogo per lo stato di caricamento: quante domande hanno un'immagine ed eventuali avvisi.
function describeQuestionImages(questions) {
    const withImage = questions.filter((question) => question.image).length;
    const parts = [];
    if (withImage > 0) {
        parts.push(`${withImage} con immagine`);
    }
    return {
        summary: parts.length ? `, ${parts.join(', ')}` : '',
        warnings: (questions.imageWarnings || []).join(' ')
    };
}

async function readQuestionsFromFile(file) {
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
        'Titolo,Domanda,Risposta A,Risposta B,Risposta C,Risposta D,Risposta Esatta,Immagine',
        '"Esempio 4 Scelte","Quale pianeta del nostro sistema solare e conosciuto come il Pianeta Rosso?","Marte","Giove","Venere","Nettuno","A",""',
        '"Esempio 3 Scelte","Quale fra questi e uno stato fisico fondamentale della materia?","Solido","Elettrico","Magnetico","","A",""',
        '"Esempio 2 Scelte (Vero/Falso)","Il Sole e una stella situata al centro del nostro sistema planetario?","Vero","Falso","","","A",""'
    ].join('\r\n');
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

function insertQuestionsIntoFlow(rawQuestions, insertIndex) {
    const nextQuestions = questionSet.map((question) => ({
        ...question,
        options: [...question.options]
    }));

    nextQuestions.splice(insertIndex, 0, ...rawQuestions);
    questionSet = cloneQuestionSet(nextQuestions);
    return questionSet.slice(insertIndex, insertIndex + rawQuestions.length);
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

function publishQuestionBatchNow(rawQuestions, source = 'Tablet docente', subject = null) {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('Nessuna domanda trovata nel file importato.');
    }

    // "Pubblica subito" una materia intera SOSTITUISCE il quiz attivo con le sole
    // domande del file: cosi il conteggio coincide sempre con il file caricato e non
    // si sommano eventuali domande gia presenti (es. la materia caricata di default).
    questionSet = cloneQuestionSet(rawQuestions);
    setQuestionFileGate(false);
    const firstQuestion = questionSet[0];

    simulationCompleted = false;
    currentQuestionIndex = 0;
    initQuizSession(subject || currentQuizSession.subject || 'Italiano', questionSet);
    resetCurrentFlow(false);
    updateImportStatus(`File docente pubblicato da ${source} (${questionSet.length} domande)`);
    logEvent(`${source}: pubblicato file con ${questionSet.length} domande. Ora attiva ${firstQuestion.title}.`);
    void savePartialQuizSession();
    // La lettura vocale della domanda viene avviata dal gestore del comando
    // (dopo l'attivazione della webcam), per non sovrapporre piu' annunci.
}

function queueQuestionBatchAsNext(rawQuestions, source = 'Tablet docente') {
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('Nessuna domanda trovata nel file importato.');
    }

    const insertIndex = simulationCompleted
        ? questionSet.length
        : Math.min(currentQuestionIndex + 1, questionSet.length);
    const insertedQuestions = insertQuestionsIntoFlow(rawQuestions, insertIndex);
    const firstQuestion = insertedQuestions[0];

    if (simulationCompleted) {
        simulationCompleted = false;
        currentQuestionIndex = insertIndex;
        resetCurrentFlow(false);
        updateImportStatus(`File docente aggiunto e aperto da ${source} (${insertedQuestions.length} domande)`);
        logEvent(`${source}: il test riparte con un file da ${insertedQuestions.length} domande.`);
        speakText(`Nuovo file del docente aggiunto. ${firstQuestion.title}.`, {
            interrupt: true,
            rate: 1.03,
            pitch: 1.05
        });
        return;
    }

    updateQuestionHeader();
    renderChoices();
    updateStateUI();
    updateImportStatus(`File docente aggiunto in coda da ${source} (${insertedQuestions.length} domande)`);
    logEvent(`${source}: aggiunto file in coda con ${insertedQuestions.length} domande.`);
    speakText('File del docente aggiunto come prossime domande.', {
        interrupt: true,
        rate: 1.02,
        pitch: 1.04
    });
}

// Comandi che agiscono sulle domande: non eseguibili finche non e' stato caricato un file.
const REMOTE_COMMANDS_REQUIRING_QUESTIONS = new Set([
    'read-question',
    'simulate-scroll',
    'simulate-select',
    'simulate-confirm',
    'reset-flow',
    'publish-now',
    'queue-next',
    'queue-batch',
    'next-question',
    'repeat-question'
]);

// Dopo la pubblicazione di un file lo studente deve poter rispondere: attiva la webcam
// senza annunciarla, poi legge subito la domanda attiva.
async function startQuizAfterPublish() {
    if (!isRunning) {
        logEvent('Quiz pubblicato: avvio automatico della webcam.');
        await startCamera({ announce: false });
    }
    void readCurrentQuestion();
}

async function executeRemoteCommand(command) {
    const payload = command.payload || {};

    if (awaitingQuestionFile && REMOTE_COMMANDS_REQUIRING_QUESTIONS.has(command.type)) {
        logEvent(`Comando ${command.type} ignorato: in attesa del file delle domande.`);
        throw new Error('Quiz in attesa del file delle domande: caricalo con il pulsante sul PC studente o pubblicalo dal pannello docente.');
    }

    if (command.type === 'start-exam') {
        ensureAudioContext();
        startExam();
        return 'Esame avviato sul PC.';
    }

    if (command.type === 'start-camera') {
        logEvent('Tablet docente: richiesta avvio webcam ricevuta.');
        if (!(await startCamera())) {
            throw new Error('Webcam USB esterna non disponibile sul PC: controlla il collegamento e riprova.');
        }
        return 'Webcam USB avviata sul PC.';
    }

    if (command.type === 'read-question') {
        ensureAudioContext();
        logEvent('Tablet docente: richiesta lettura domanda ricevuta.');
        void readCurrentQuestion();
        return 'Lettura domanda avviata sul PC.';
    }

    if (command.type === 'simulate-scroll') {
        ensureAudioContext();
        handleScrollCommand('Tablet docente');
        return 'Scroll risposta eseguito sul PC.';
    }

    if (command.type === 'simulate-select') {
        ensureAudioContext();
        const isCancelMode = currentState === 'confirm';
        if (isCancelMode) {
            await simulateEyeHold('cancel', 'Tablet docente');
        } else {
            await simulateEyeHold('select', 'Tablet docente');
        }
        return isCancelMode
            ? 'Richiesta annullamento elaborata sul PC.'
            : 'Richiesta selezione elaborata sul PC.';
    }

    if (command.type === 'simulate-confirm') {
        ensureAudioContext();
        if (currentState === 'confirm') {
            confirmSelection('Tablet docente');
            return 'Conferma risposta eseguita sul PC.';
        } else {
            logEvent('Tablet docente: conferma ignorata, safe check non attivo.');
            return 'Conferma ignorata: safe check non attivo sul PC.';
        }
    }

    if (command.type === 'reset-flow') {
        resetCurrentFlow(true);
        logEvent('Tablet docente: reset completo della simulazione.');
        speakText('Simulazione resettata dal professore.', { interrupt: true, rate: 1.03 });
        return 'Quiz resettato sul PC.';
    }

    if (command.type === 'publish-now') {
        publishQuestionNow(payload.question || {}, 'Tablet docente');
        return 'Nuova domanda pubblicata subito sul PC.';
    }

    if (command.type === 'queue-next') {
        queueQuestionAsNext(payload.question || {}, 'Tablet docente');
        return 'Nuova domanda messa in coda sul PC.';
    }

    if (command.type === 'publish-batch') {
        publishQuestionBatchNow(payload.questions || [], 'Tablet docente', payload.subject);
        await startQuizAfterPublish();
        return 'File di domande pubblicato subito sul PC.';
    }

    if (command.type === 'resume-session') {
        let session = payload.session;
        if (!session) {
            try {
                const res = await fetchJson('/api/quiz/active-session');
                session = res && res.session;
            } catch (err) {}
        }
        if (session) {
            resumeQuizSession(session);
            if (!isRunning) {
                await startCamera({ announce: false });
            }
            void readCurrentQuestion();
            return `Test di ${session.materia || 'materia'} ripreso con successo alla domanda ${currentQuestionIndex + 1}.`;
        }
        return 'Nessun test sospeso trovato da riprendere.';
    }

    if (command.type === 'restart-session') {
        let session = payload.session;
        if (!session) {
            try {
                const res = await fetchJson('/api/quiz/active-session');
                session = res && res.session;
            } catch (err) {}
        }
        if (session) {
            restartQuizSession(session);
            if (!isRunning) {
                await startCamera({ announce: false });
            }
            void readCurrentQuestion();
            return `Test di ${session.materia || 'materia'} riavviato dall'inizio.`;
        }
        return 'Nessun test trovato da riavviare.';
    }

    if (command.type === 'new-session') {
        initQuizSession(payload.subject || 'Italiano', DEFAULT_QUESTION_SET);
        questionSet = cloneQuestionSet(DEFAULT_QUESTION_SET);
        currentQuestionIndex = 0;
        simulationCompleted = false;
        resetCurrentFlow(true);
        hideSuspendedBanner();
        // Un nuovo test riparte dalla schermata iniziale: va caricato il file delle domande.
        setQuestionFileGate(true);
        logEvent('Nuovo test pronto: in attesa del file delle domande.');
        return 'Nuova sessione di test avviata: in attesa del file delle domande.';
    }

    if (command.type === 'set-student') {
        if (payload.student) {
            currentQuizSession.student = payload.student;
            logEvent(`Studente attivo impostato su: ${payload.student}`);
            return `Studente impostato su: ${payload.student}`;
        }
        return 'Nome studente non specificato.';
    }

    if (command.type === 'set-subject') {
        if (payload.subject) {
            currentQuizSession.subject = payload.subject;
            logEvent(`Materia attiva impostata su: ${payload.subject}`);
            return `Materia impostata su: ${payload.subject}`;
        }
        return 'Materia non specificata.';
    }

    if (command.type === 'queue-batch') {
        queueQuestionBatchAsNext(payload.questions || [], 'Tablet docente');
        return 'File di domande aggiunto in coda sul PC.';
    }

    if (command.type === 'next-question') {
        ensureAudioContext();
        if (simulationCompleted) {
            return 'Quiz gia completato: nessuna domanda successiva.';
        }
        const wasLast = currentQuestionIndex >= questionSet.length - 1;
        advanceQuestion();
        return wasLast
            ? 'Quiz completato sul PC.'
            : 'Passaggio alla domanda successiva sul PC.';
    }

    if (command.type === 'repeat-question') {
        ensureAudioContext();
        if (simulationCompleted) {
            return 'Quiz completato: nessuna domanda da ripetere.';
        }
        resetCurrentFlow(false);
        logEvent('Tablet docente: ripetizione della domanda corrente.');
        void readCurrentQuestion();
        return 'Domanda ripetuta sul PC.';
    }

    if (command.type === 'open-pdf') {
        const url = payload.url || `/api/quiz/export-pdf?student=${encodeURIComponent(payload.student || currentQuizSession.student)}&file=${encodeURIComponent(payload.fileName || currentQuizSession.fileName || '')}`;
        logEvent('Tablet docente: apertura scheda PDF della prova nel browser studente.');
        try {
            window.open(url, '_blank');
        } catch (e) {
            window.location.href = url;
        }
        speakText('Il professore ha aperto il documento PDF con i risultati della tua prova.', { interrupt: false });
        return 'Scheda PDF della prova aperta nel browser studente.';
    }

    return 'Comando remoto ricevuto.';
}

function hideExamGate() {
    const gate = document.getElementById('examGate');
    if (gate && gate.parentNode) {
        gate.parentNode.removeChild(gate);
    }
}

function startExam() {
    examStarted = true;
    hideExamGate();
    resetCurrentFlow(true);
    setCommandState('In attesa');
}

async function pollRemoteCommands() {
    if (!REMOTE_SYNC_ENABLED || remoteCommandPollInFlight) {
        return;
    }

    remoteCommandPollInFlight = true;

    try {
        const after = remoteLastCommandId === null ? remoteLastAckedCommandId : remoteLastCommandId;
        const response = await fetchJson(`/api/commands?after=${after}`);
        const commands = Array.isArray(response.commands) ? response.commands : [];
        const latestCommandId = Number(response.latestCommandId || 0);
        const ackedCommandId = Number(response.ackedCommandId || 0);

        if (remoteLastCommandId === null) {
            remoteLastAckedCommandId = ackedCommandId;
            remoteLastCommandId = ackedCommandId;
        }

        for (const command of commands) {
            let commandStatus = 'ok';
            let commandMessage = 'Comando eseguito sul PC.';

            try {
                commandMessage = await executeRemoteCommand(command);
            } catch (error) {
                commandStatus = 'error';
                commandMessage = error.message || 'Errore durante l esecuzione sul PC.';
                console.error('Errore comando remoto:', error);
                logEvent(`Comando remoto fallito: ${commandMessage}`);
            }

            try {
                await acknowledgeRemoteCommand(command, commandStatus, commandMessage);
            } catch (ackError) {
                console.error('Errore ack comando remoto:', ackError);
                setRemoteSyncStatus('Conferma comando non inviata al server', true);
                break;
            }
        }

        if (commands.length === 0) {
            remoteLastCommandId = Math.max(remoteLastCommandId || 0, ackedCommandId, latestCommandId);
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

function playRichTone(options = {}) {
    const ctx = ensureAudioContext();
    if (!ctx) {
        return;
    }
    const {
        frequency = 440,
        durationMs = 200,
        type = 'sine',
        gain = 0.08,
        attackMs = 14,
        detune = 0,
        slideToFrequency = null,
        slideMs = null,
        startDelayMs = 0,
        filter = null
    } = options;

    const startTime = ctx.currentTime + Math.max(0, startDelayMs) / 1000;
    const endTime = startTime + durationMs / 1000;
    const attackEnd = startTime + Math.min(attackMs, durationMs * 0.6) / 1000;

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    if (detune) {
        oscillator.detune.setValueAtTime(detune, startTime);
    }
    if (slideToFrequency != null) {
        const slideEnd = startTime + (slideMs ?? durationMs) / 1000;
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideToFrequency), slideEnd);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), attackEnd);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gainNode);

    if (filter) {
        const filterNode = ctx.createBiquadFilter();
        filterNode.type = filter.type || 'lowpass';
        filterNode.frequency.setValueAtTime(filter.frequency || 1200, startTime);
        if (filter.Q != null) {
            filterNode.Q.setValueAtTime(filter.Q, startTime);
        }
        gainNode.connect(filterNode);
        filterNode.connect(ctx.destination);
    } else {
        gainNode.connect(ctx.destination);
    }

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.05);
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
    } else if (type === 'success') {
        playRichTone({ frequency: 523.25, durationMs: 150, type: 'triangle', gain: 0.12, attackMs: 8, startDelayMs: 0 });
        playRichTone({ frequency: 659.25, durationMs: 150, type: 'triangle', gain: 0.13, attackMs: 8, startDelayMs: 95 });
        playRichTone({ frequency: 783.99, durationMs: 170, type: 'triangle', gain: 0.14, attackMs: 8, startDelayMs: 190 });
        playRichTone({ frequency: 1046.5, durationMs: 520, type: 'sine', gain: 0.17, attackMs: 10, startDelayMs: 300 });
        playRichTone({ frequency: 1568.0, durationMs: 460, type: 'sine', gain: 0.06, attackMs: 14, startDelayMs: 300, detune: 5 });
        playRichTone({ frequency: 2093.0, durationMs: 360, type: 'sine', gain: 0.04, attackMs: 18, startDelayMs: 360 });
        playRichTone({ frequency: 261.63, durationMs: 520, type: 'sine', gain: 0.07, attackMs: 16, startDelayMs: 300 });
        window.setTimeout(() => {
            playRichTone({ frequency: 2637.0, durationMs: 110, type: 'sine', gain: 0.05, attackMs: 6 });
            playRichTone({ frequency: 3136.0, durationMs: 90, type: 'sine', gain: 0.035, attackMs: 6, startDelayMs: 70 });
        }, 540);
    } else if (type === 'miss') {
        playRichTone({
            frequency: 440, durationMs: 280, type: 'triangle', gain: 0.11, attackMs: 14,
            filter: { type: 'lowpass', frequency: 1500 }
        });
        playRichTone({
            frequency: 370, durationMs: 320, type: 'triangle', gain: 0.11, attackMs: 14, startDelayMs: 220,
            filter: { type: 'lowpass', frequency: 1200 }
        });
        playRichTone({
            frequency: 330, durationMs: 520, type: 'sine', gain: 0.1, attackMs: 18, startDelayMs: 480,
            slideToFrequency: 247, slideMs: 460,
            filter: { type: 'lowpass', frequency: 1000 }
        });
        playRichTone({
            frequency: 165, durationMs: 620, type: 'sine', gain: 0.05, attackMs: 24, startDelayMs: 220,
            filter: { type: 'lowpass', frequency: 700 }
        });
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
    // Voci neurali di alta qualita (Edge "Online (Natural)"): priorita massima.
    if (name.includes('natural') || name.includes('online')) {
        score += 80;
    }
    // Voci femminili italiane note di Edge/Windows.
    if (name.includes('elsa') || name.includes('isabella') || name.includes('alice') || name.includes('federica') || name.includes('lucia') || name.includes('giulia')) {
        score += 45;
    }
    if (name.includes('female') || name.includes('woman') || name.includes('donna')) {
        score += 30;
    }
    // Penalizza le voci maschili note (es. Diego) per restare su una voce femminile.
    if (name.includes('diego') || name.includes('cosimo') || name.includes('male') || name.includes('uomo')) {
        score -= 60;
    }
    if (name.includes('microsoft')) {
        score += 12;
    } else if (name.includes('google')) {
        score += 8;
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

function clearReadingHighlight() {
    document.querySelectorAll('.is-being-read').forEach((element) => {
        element.classList.remove('is-being-read');
    });
}

function cancelActiveReadingSequence() {
    activeReadingSequenceId += 1;
    clearReadingHighlight();
}

function setReadingHighlight(target) {
    clearReadingHighlight();
    if (!target) {
        return;
    }

    if (target.container) {
        target.container.classList.add('is-being-read');
    }
    if (target.text) {
        target.text.classList.add('is-being-read');
    }
}

function speakText(text, options = {}) {
    if (!('speechSynthesis' in window)) {
        return Promise.resolve();
    }
    const {
        interrupt = false,
        rate = 0.98,
        pitch = 1.0,
        volume = 1,
        onStart = null,
        onEnd = null,
        resetReadingCue = interrupt
    } = options;

    if (interrupt) {
        window.speechSynthesis.cancel();
        if (resetReadingCue) {
            cancelActiveReadingSequence();
        }
    }

    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'it-IT';
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        let isSettled = false;

        const finish = () => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            if (typeof onEnd === 'function') {
                onEnd();
            }
            resolve();
        };

        utterance.onstart = () => {
            if (typeof onStart === 'function') {
                onStart();
            }
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        const voice = getItalianVoice();
        if (voice) {
            utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
    });
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

// Mostra (o nasconde) l'immagine della domanda accanto al testo.
function renderQuestionImage(question) {
    const hasImage = Boolean(question && question.image);
    questionCard.classList.toggle('has-image', hasImage);
    questionMedia.hidden = !hasImage;
    questionImageFallback.hidden = true;
    questionImageFallback.textContent = '';

    if (!hasImage) {
        questionImage.removeAttribute('src');
        return;
    }

    questionImage.hidden = false;
    questionImage.src = question.image;
}

// Se il file non si carica, lo studente vede un avviso al posto dell'immagine.
questionImage.addEventListener('error', () => {
    const question = simulationCompleted || awaitingQuestionFile ? null : currentQuestion();
    if (!question || !question.image) {
        return;
    }
    questionImage.hidden = true;
    questionImageFallback.hidden = false;
    questionImageFallback.textContent = 'Immagine non disponibile.';
    logEvent(`Immagine non caricata: ${question.image}`);
});

function updateQuestionHeader() {
    clearReadingHighlight();
    if (simulationCompleted) {
        questionTitle.textContent = 'Quiz completato';
        questionCounter.textContent = `${questionSet.length} / ${questionSet.length}`;
        questionText.textContent = 'Quiz completato. In pausa, in attesa che il professore carichi nuove domande o concluda la sessione.';
        renderQuestionImage(null);
        requestStudentSnapshotSync();
        return;
    }
    const question = currentQuestion();
    questionTitle.textContent = question.title;
    questionCounter.textContent = `${currentQuestionIndex + 1} / ${questionSet.length}`;
    questionText.textContent = question.prompt;
    renderQuestionImage(question);
    requestStudentSnapshotSync();
}

function syncConfirmCard() {
    const showConfirm = currentState === 'confirm';
    confirmCard.classList.toggle('hidden', !showConfirm);
    if (!showConfirm || selectedIndex === null || selectedIndex < 0) {
        confirmProgress = 0;
        confirmProgressBar.style.transform = 'scaleX(0)';
        return;
    }
    const currentQ = currentQuestion();
    if (!currentQ || !currentQ.options || !currentQ.options[selectedIndex]) {
        return;
    }
    const label = OPTION_LETTERS[selectedIndex] || 'A';
    const option = currentQ.options[selectedIndex] || '';
    confirmTitle.textContent = `Hai scelto la ${label}`;
    confirmText.textContent = `Risposta in focus: ${option}. Apri la bocca per confermare. Tieni gli occhi chiusi per annullare.`;
    confirmProgressBar.style.transform = `scaleX(${confirmProgress})`;
    confirmProgressBar.style.background = confirmProgressMode === 'cancel'
        ? 'linear-gradient(90deg, #ff6b6b, #ff5fa2)'
        : 'linear-gradient(90deg, #2de2e6, #ffd166)';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderChoices() {
    clearReadingHighlight();
    if (simulationCompleted) {
        choicesGrid.innerHTML = '';
        choicesGrid.dataset.count = '0';
        choicesGrid.className = 'choices-grid choices-grid--completed';
        choiceButtons = [];

        const score = currentQuizSession.score || recalculateSessionScore();
        const student = currentQuizSession.student || 'Studente';
        const subject = currentQuizSession.subject || 'Quiz';
        const fileParam = currentQuizSession.fileName ? `&file=${encodeURIComponent(currentQuizSession.fileName)}` : '';
        const printUrl = `/stampa-risultato?student=${encodeURIComponent(student)}${fileParam}&autoPrint=1`;
        const exportPdfDownloadUrl = `/api/quiz/export-pdf?student=${encodeURIComponent(student)}${fileParam}&download=1`;
        const exportPdfViewUrl = `/api/quiz/export-pdf?student=${encodeURIComponent(student)}${fileParam}`;

        const completedBox = document.createElement('div');
        completedBox.className = 'quiz-completed-box';
        completedBox.innerHTML = `
            <div class="completed-badge">🎉 Quiz Concluso</div>
            <h2 class="completed-subject-title">Risultati: ${escapeHtml(subject)}</h2>
            <p class="completed-student-name">Studente: <strong>${escapeHtml(student)}</strong></p>
            <div class="completed-score-grid">
                <div class="score-card score-card--pct">
                    <span class="score-val">${score.percentuale}%</span>
                    <span class="score-lbl">Esito complessivo</span>
                </div>
                <div class="score-card score-card--correct">
                    <span class="score-val">${score.esatte}</span>
                    <span class="score-lbl">Risposte esatte</span>
                </div>
                <div class="score-card score-card--wrong">
                    <span class="score-val">${score.errate}</span>
                    <span class="score-lbl">Risposte errate</span>
                </div>
                <div class="score-card score-card--total">
                    <span class="score-val">${score.totaleRisposte} / ${questionSet.length}</span>
                    <span class="score-lbl">Domande completate</span>
                </div>
            </div>
            <div class="completed-actions">
                <button type="button" id="studentExportDesktopBtn" class="action-btn primary completed-print-btn" title="Salva direttamente il PDF nella cartella Desktop del PC dove si trova il server">
                    💾 Salva PDF su Desktop Server
                </button>
                <a href="${exportPdfViewUrl}" target="_blank" class="action-btn secondary completed-print-btn" title="Apri il documento PDF in una nuova scheda del browser">
                    👁️ Apri PDF nel Browser
                </a>
                <a href="${exportPdfDownloadUrl}" class="action-btn secondary completed-print-btn" download title="Scarica il PDF della prova direttamente sul dispositivo">
                    📥 Scarica PDF
                </a>
                <a href="${printUrl}" target="_blank" class="action-btn ghost completed-print-btn">
                    🖨️ Stampa Scheda
                </a>
            </div>
            <div id="studentExportStatus" class="student-export-status" style="margin-top: 14px; font-weight: 700; font-size: 0.95rem; text-align: center; color: #16a34a;" hidden></div>
        `;
        choicesGrid.appendChild(completedBox);

        const exportBtn = completedBox.querySelector('#studentExportDesktopBtn');
        const statusBox = completedBox.querySelector('#studentExportStatus');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                exportBtn.disabled = true;
                if (statusBox) {
                    statusBox.hidden = false;
                    statusBox.style.color = '#2563eb';
                    statusBox.textContent = 'Esportazione del PDF sul Desktop del server in corso...';
                }
                try {
                    const res = await fetchJson('/api/quiz/export-pdf-desktop', {
                        method: 'POST',
                        body: JSON.stringify({
                            student: currentQuizSession.student,
                            file: currentQuizSession.fileName
                        })
                    });
                    if (res && res.ok) {
                        if (statusBox) {
                            statusBox.style.color = '#16a34a';
                            statusBox.textContent = `✅ PDF salvato con successo sul Desktop del server: ${res.fileName}`;
                        }
                        logEvent(`PDF salvato sul Desktop: ${res.fileName}`);
                        speakText('Il documento PDF con la tua prova è stato salvato sul Desktop del computer.', { interrupt: false });
                    } else {
                        throw new Error((res && res.error) || 'Errore durante la generazione del PDF.');
                    }
                } catch (err) {
                    if (statusBox) {
                        statusBox.style.color = '#dc2626';
                        statusBox.textContent = `❌ Errore esportazione: ${err.message}`;
                    }
                } finally {
                    exportBtn.disabled = false;
                }
            });
        }
        return;
    }

    const question = currentQuestion();
    const count = question.options.length;
    choicesGrid.dataset.count = String(count);
    choicesGrid.className = `choices-grid choices-grid--${count}`;

    choicesGrid.innerHTML = question.options.map((option, index) => `
        <button class="choice-card" data-index="${index}" style="--choice-bg: ${CHOICE_THEMES[index]}; --progress: 0;">
            <div class="choice-selection-badge" aria-hidden="true">
                <span class="choice-badge-icon">⏳</span>
                <span class="choice-badge-text">SELEZIONE IN CORSO</span>
            </div>
            <div class="choice-progress"></div>
            <div class="choice-content">
                <div class="choice-letter">${OPTION_LETTERS[index]}</div>
                <div class="choice-text">${escapeHtml(option)}</div>
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

            updateStateUI();
        });
    });

    syncChoices();
}

function syncChoices() {
    if (currentState === 'confirm' && selectedIndex !== null) {
        focusedIndex = selectedIndex;
    }

    choiceButtons.forEach((button, index) => {
        const isFocused = index === focusedIndex && ['focus', 'preselect', 'confirm'].includes(currentState);
        const isSelecting = currentState === 'preselect' && index === focusedIndex;
        const isSelected = currentState === 'confirm' && index === selectedIndex;
        const isDimmed = currentState === 'confirm' && selectedIndex !== null && index !== selectedIndex;
        const answeredOrDone = currentState === 'answered' || currentState === 'done';
        const freeChoice = isFreeChoiceQuestion();
        const isConfirmed = answeredOrDone && answerLockedIndex === index;
        // Nelle domande a scelta libera evidenziamo come "accettata" la risposta scelta
        // dallo studente, senza rivelare un'opzione corretta ne segnalare errori.
        const isCorrect = answeredOrDone && (freeChoice
            ? answerLockedIndex === index
            : currentQuestion().correctIndex === index);
        const isWrong = !freeChoice && answeredOrDone
            && answerLockedIndex === index
            && answerLockedIndex !== currentQuestion().correctIndex;

        let progress = 0;
        if (isSelecting) {
            progress = optionProgress;
        } else if ((currentState === 'confirm' || answeredOrDone) && index === (selectedIndex ?? answerLockedIndex)) {
            progress = 1;
        }

        button.classList.toggle('is-focused', isFocused);
        button.classList.toggle('is-selecting', isSelecting);
        button.classList.toggle('is-selected', isSelected);
        button.classList.toggle('is-dimmed', isDimmed);
        button.classList.toggle('is-confirmed', isConfirmed);
        button.classList.toggle('is-correct', isCorrect);
        button.classList.toggle('is-wrong', isWrong);
        button.style.setProperty('--progress', progress.toFixed(3));

        const badge = button.querySelector('.choice-selection-badge');
        if (badge) {
            const badgeIcon = badge.querySelector('.choice-badge-icon');
            const badgeText = badge.querySelector('.choice-badge-text');
            if (isSelecting) {
                if (badgeIcon) badgeIcon.textContent = '⏳';
                if (badgeText) badgeText.textContent = 'SELEZIONE IN CORSO...';
            } else if (isSelected) {
                if (badgeIcon) badgeIcon.textContent = '✨';
                if (badgeText) badgeText.textContent = 'RISPOSTA SELEZIONATA';
            }
        }
    });
}

function updateStateUI() {
    const meta = STATE_META[currentState] || STATE_META.idle;
    systemState.textContent = meta.label;
    systemState.style.background = meta.pill;
    phaseState.textContent = meta.phase;
    systemInstruction.textContent = meta.instruction;

    const curQ = currentQuestion();
    const optCount = curQ && Array.isArray(curQ.options) ? curQ.options.length : 0;

    if (currentState === 'focus' && focusedIndex >= 0 && focusedIndex < optCount) {
        const letter = OPTION_LETTERS[focusedIndex];
        const optText = curQ.options[focusedIndex] || '';
        systemInstruction.textContent = `Risposta ${letter} in evidenza (${optText}). Apri la bocca per scorrere o chiudi gli occhi per selezionare.`;
    }

    if (currentState === 'preselect' && focusedIndex >= 0 && focusedIndex < optCount) {
        const letter = OPTION_LETTERS[focusedIndex];
        const optText = curQ.options[focusedIndex] || '';
        systemInstruction.textContent = `Stai selezionando la risposta ${letter} (${optText}). Mantieni gli occhi chiusi per completare la scelta!`;
    }

    if (currentState === 'confirm' && selectedIndex !== null && selectedIndex >= 0 && selectedIndex < optCount) {
        const letter = OPTION_LETTERS[selectedIndex];
        const optText = curQ.options[selectedIndex] || '';
        systemInstruction.textContent = `Hai scelto la risposta ${letter} (${optText}). Apri la bocca per confermare, oppure chiudi gli occhi per annullare.`;
    }

    if (currentState === 'answered' || currentState === 'done') {
        const chosen = answerLockedIndex !== null && answerLockedIndex >= 0 ? OPTION_LETTERS[answerLockedIndex] : '';
        systemInstruction.textContent = chosen ? `Risposta ${chosen} registrata.` : 'Risposta registrata.';
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

    hideAnswerFeedback();

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
    currentQuizSession.status = 'completato';
    recalculateSessionScore();
    void saveTotalQuizSession();

    setState('done');
    updateQuestionHeader();
    renderChoices();
    setCommandState('Quiz completato - in pausa');
    logEvent('Quiz completato. Risultati salvati nella cartella dello studente.');
    speakText('Quiz completato. Risultati salvati.', { interrupt: true, rate: 1.02 });
}

function advanceQuestion() {
    hideAnswerFeedback();

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

async function readCurrentQuestion() {
    if (simulationCompleted) {
        await speakText('Il test e completato. Premi reset per ricominciare.', { interrupt: true, rate: 1.02 });
        return;
    }

    const question = currentQuestion();
    const sequenceId = activeReadingSequenceId + 1;
    activeReadingSequenceId = sequenceId;

    const segments = [
        {
            text: `${question.title}. ${question.prompt}.`,
            target: {
                container: questionCard,
                text: questionText
            }
        },
        { text: 'Opzioni.' },
        ...question.options.map((option, index) => ({
            text: option,
            target: {
                container: choiceButtons[index],
                text: choiceButtons[index]?.querySelector('.choice-text')
            }
        })),
        {
            text: systemInstruction.textContent,
            target: {
                container: instructionBar,
                text: systemInstruction
            }
        }
    ];

    logEvent('Lettura vocale della domanda attivata.');

    for (let index = 0; index < segments.length; index += 1) {
        if (sequenceId !== activeReadingSequenceId) {
            return;
        }

        const segment = segments[index];
        await speakText(segment.text, {
            interrupt: index === 0,
            resetReadingCue: false,
            rate: 1.01,
            pitch: 1.04,
            onStart: () => {
                if (sequenceId === activeReadingSequenceId) {
                    setReadingHighlight(segment.target);
                }
            }
        });
    }

    if (sequenceId === activeReadingSequenceId) {
        clearReadingHighlight();
    }
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
    if (focusedIndex < 0) {
        focusedIndex = 0;
    }
    selectedIndex = focusedIndex;
    optionProgress = 1;
    confirmProgress = 0;
    confirmProgressMode = 'confirm';
    confirmCancelEnabled = false;
    setState('confirm');
    setCommandState('Safe check attivo');
    playChime('select');
    logEvent(`${source}: risposta ${OPTION_LETTERS[selectedIndex]} catturata, safe check aperto.`);
    speakText(`Hai scelto ${currentQuestion().options[selectedIndex]}. Apri la bocca per confermare.`, {
        interrupt: true,
        rate: 1.04
    });
}

function cancelSelection(source) {
    selectedIndex = null;
    if (focusedIndex < 0) {
        focusedIndex = 0;
    }
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

const CORRECT_FEEDBACK_TITLES = [
    'Bravissimo!',
    'Fantastico!',
    'Eccellente!',
    'Ottimo lavoro!',
    'Perfetto!',
    'Sei un campione!',
    'Risposta giusta!',
    'Grandioso!',
    'Splendido!',
    'Complimenti!',
    'Magnifico!',
    'Strepitoso!'
];
const CORRECT_FEEDBACK_SUBTITLES = [
    'Hai centrato in pieno la risposta giusta, continua cosi.',
    'Stai andando alla grande, non fermarti adesso.',
    'La tua attenzione sta dando ottimi frutti, bravo.',
    'Si vede che hai studiato, questa l\'hai presa al volo.',
    'Il tuo impegno e visibile, vai avanti con questo ritmo.',
    'Hai dimostrato di sapere la risposta, davvero bravo.',
    'Ottima concentrazione, sei in forma smagliante.',
    'Risposta perfetta, mantieni questa lucidita.',
    'Questa l\'hai centrata senza esitazioni, continua cosi.',
    'Stai facendo un lavoro eccezionale, vai avanti deciso.',
    'Hai colpito nel segno, sei sulla strada giusta.',
    'Bravo davvero, le tue risposte sono precise.'
];
const ACCEPTED_FEEDBACK_TITLES = [
    'Risposta registrata!',
    'Scelta confermata!',
    'Ottima scelta!',
    'Bravo, hai scelto!',
    'Benissimo!'
];
const ACCEPTED_FEEDBACK_SUBTITLES = [
    'La tua scelta e stata registrata, andiamo avanti.',
    'Hai scelto la tua risposta, continua cosi.',
    'Bene cosi, passiamo alla prossima.',
    'Scelta presa con sicurezza, bravo.',
    'Procediamo, stai andando benissimo.'
];
const WRONG_FEEDBACK_TITLES = [
    'Riproviamo!',
    'Non era questa volta',
    'Quasi ci sei',
    'Coraggio!',
    'Niente paura',
    'Su, ci sei vicino',
    'Concentrati!',
    'Ce la puoi fare',
    'Non mollare',
    'Forza, alla prossima',
    'Un passo indietro',
    'Sbaglia chi non prova'
];
const WRONG_FEEDBACK_SUBTITLES = [
    'Respira con calma, leggi bene la domanda e riprova alla prossima.',
    'Presta piu attenzione alle parole della domanda, ce la farai.',
    'Ogni errore e un passo in avanti, non perdere la fiducia.',
    'Prenditi il tuo tempo, alla prossima sarai piu lucido.',
    'Concentrati sulle parole chiave della domanda e vedrai che migliori.',
    'Anche sbagliando si impara, vai avanti con determinazione.',
    'Forza, dai il massimo della concentrazione sulla prossima domanda.',
    'Non perderti d\'animo, hai tutte le carte per riuscirci.',
    'Sii paziente con te stesso, la prossima la prendi al volo.',
    'Rallenta, rileggi con calma e ascolta bene le opzioni.',
    'Tieni alta l\'attenzione, alla prossima darai il meglio di te.',
    'Coraggio, sei piu bravo di quello che pensi, riprova con calma.'
];
const FEEDBACK_PARTICLE_COLORS = ['#71f79f', '#2de2e6', '#ffd166', '#ff7b9c', '#7cc8ff', '#ffffff'];

let feedbackHideTimer = null;
let feedbackClassTimer = null;

function pickFeedbackText(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function spawnFeedbackParticles() {
    if (!answerFeedbackParticles) {
        return;
    }
    answerFeedbackParticles.innerHTML = '';
    const count = 28;
    for (let i = 0; i < count; i += 1) {
        const particle = document.createElement('span');
        particle.className = 'answer-feedback__particle';
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
        const distance = 150 + Math.random() * 130;
        const size = 8 + Math.random() * 9;
        particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
        particle.style.setProperty('--rot', `${Math.random() * 600 - 300}deg`);
        particle.style.setProperty('--delay', `${Math.random() * 0.18}s`);
        particle.style.background = FEEDBACK_PARTICLE_COLORS[i % FEEDBACK_PARTICLE_COLORS.length];
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        if (Math.random() < 0.45) {
            particle.style.borderRadius = '50%';
        }
        answerFeedbackParticles.appendChild(particle);
    }
}

function showAnswerFeedback(outcome) {
    // outcome: 'correct' | 'wrong' | 'accepted' (scelta libera, sempre positiva)
    const positive = outcome === 'correct' || outcome === 'accepted';
    let title;
    let subtitle;
    if (outcome === 'accepted') {
        title = pickFeedbackText(ACCEPTED_FEEDBACK_TITLES);
        subtitle = pickFeedbackText(ACCEPTED_FEEDBACK_SUBTITLES);
    } else if (outcome === 'correct') {
        title = pickFeedbackText(CORRECT_FEEDBACK_TITLES);
        subtitle = pickFeedbackText(CORRECT_FEEDBACK_SUBTITLES);
    } else {
        title = pickFeedbackText(WRONG_FEEDBACK_TITLES);
        subtitle = pickFeedbackText(WRONG_FEEDBACK_SUBTITLES);
    }

    if (!answerFeedback) {
        return { title, subtitle };
    }
    window.clearTimeout(feedbackHideTimer);
    window.clearTimeout(feedbackClassTimer);

    answerFeedback.classList.remove('answer-feedback--correct', 'answer-feedback--wrong');
    answerFeedback.classList.add(positive ? 'answer-feedback--correct' : 'answer-feedback--wrong');

    if (answerFeedbackBadge) {
        answerFeedbackBadge.textContent = positive ? '★' : '✨';
    }
    if (answerFeedbackTitle) {
        answerFeedbackTitle.textContent = title;
    }
    if (answerFeedbackSubtitle) {
        answerFeedbackSubtitle.textContent = subtitle;
    }

    if (positive) {
        spawnFeedbackParticles();
    } else if (answerFeedbackParticles) {
        answerFeedbackParticles.innerHTML = '';
    }

    answerFeedback.classList.remove('hidden');
    requestAnimationFrame(() => {
        answerFeedback.classList.add('is-active');
    });

    if (quizCardStudent) {
        quizCardStudent.classList.remove('is-correct-flash', 'is-wrong-flash');
        void quizCardStudent.offsetWidth;
        quizCardStudent.classList.add(positive ? 'is-correct-flash' : 'is-wrong-flash');
    }

    feedbackHideTimer = window.setTimeout(() => {
        hideAnswerFeedback();
    }, CONFIG.answerFeedbackVisibleMs);

    return { title, subtitle };
}

function hideAnswerFeedback() {
    window.clearTimeout(feedbackHideTimer);
    window.clearTimeout(feedbackClassTimer);
    if (quizCardStudent) {
        quizCardStudent.classList.remove('is-correct-flash', 'is-wrong-flash');
    }
    if (!answerFeedback) {
        return;
    }
    answerFeedback.classList.remove('is-active');
    feedbackClassTimer = window.setTimeout(() => {
        answerFeedback.classList.add('hidden');
        answerFeedback.classList.remove('answer-feedback--correct', 'answer-feedback--wrong');
        if (answerFeedbackParticles) {
            answerFeedbackParticles.innerHTML = '';
        }
    }, 320);
}

function confirmSelection(source) {
    if (selectedIndex === null || simulationCompleted) {
        return;
    }

    answerLockedIndex = selectedIndex;
    setState('answered');
    setCommandState('Risposta registrata');

    const freeChoice = isFreeChoiceQuestion();
    const isCorrect = answerLockedIndex === currentQuestion().correctIndex;
    const outcome = freeChoice ? 'accepted' : (isCorrect ? 'correct' : 'wrong');
    const positive = outcome !== 'wrong';
    playChime(positive ? 'success' : 'miss');

    const curQ = currentQuestion();
    currentQuizSession.answers[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        questionTitle: curQ.title,
        prompt: curQ.prompt,
        options: [...curQ.options],
        correctIndex: curQ.correctIndex,
        chosenIndex: answerLockedIndex,
        chosenText: curQ.options[answerLockedIndex] || '',
        outcome: outcome,
        isCorrect: isCorrect,
        freeChoice: freeChoice,
        answeredAt: new Date().toISOString()
    };
    recalculateSessionScore();
    void savePartialQuizSession();

    const { title, subtitle } = showAnswerFeedback(outcome);
    const spokenFeedback = `${title} ${subtitle}`;

    const esito = freeChoice ? 'scelta registrata' : (isCorrect ? 'corretta' : 'errata');
    logEvent(`${source}: risposta ${OPTION_LETTERS[answerLockedIndex]} confermata (${esito}).`);
    window.setTimeout(() => {
        speakText(spokenFeedback, {
            interrupt: true,
            rate: 1.0,
            pitch: positive ? 1.08 : 0.97
        });
    }, 320);

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
        speakText(`Navigazione attiva. ${currentQuestion().options[0]}.`, {
            interrupt: true,
            rate: 1.05
        });
        return;
    }

    if (currentState === 'focus') {
        focusedIndex = (focusedIndex + 1) % currentQuestion().options.length;
        optionProgress = 0;
        setCommandState(`Scroll: risposta ${OPTION_LETTERS[focusedIndex]}`);
        updateStateUI();
        logEvent(`${source}: focus spostato sulla risposta ${OPTION_LETTERS[focusedIndex]}.`);
        speakText(`${currentQuestion().options[focusedIndex]}.`, {
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

    // Quiz non ancora aperto: i gesti del viso non devono muovere nulla dietro la schermata iniziale.
    if (awaitingQuestionFile) {
        mouthOpenStartedAt = null;
        eyeHoldStartedAt = null;
        cancelHoldStartedAt = null;
        return;
    }

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
    const now = Date.now();
    canvasCtx.save();
    canvasCtx.fillStyle = '#08111f';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        lastFaceDetected = true;
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
        latestFraming = computeFramingFromLandmarks(landmarks, true);

        updateSensorCard(elRightEyeCard, elRightEyeStatus, elRightEyeEar, rightEar, EAR_THRESHOLD, 'eye');
        updateSensorCard(elLeftEyeCard, elLeftEyeStatus, elLeftEyeEar, leftEar, EAR_THRESHOLD, 'eye');
        updateSensorCard(elMouthCard, elMouthStatus, elMouthMar, mar, MAR_THRESHOLD, 'mouth');
        updateZoomCanvas(landmarks, results.image);
        updateChoiceMachine(leftEar, rightEar, mar, true);
    } else {
        lastFaceDetected = false;
        latestFraming = createEmptyFraming(true);
        updateZoomCanvas(null, null);
        updateChoiceMachine(latestEarLeft, latestEarRight, latestMar, false);
    }

    canvasCtx.restore();
    publishDebugSnapshot(true);

    if (REMOTE_SYNC_ENABLED && now - remoteLastFrameAt >= REMOTE_DEBUG_FRAME_INTERVAL_MS) {
        remoteLastFrameAt = now;
        requestStudentSnapshotSync(true);
    }
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

// La webcam deve essere esterna (USB): vedi webcam-usb.js. Se non e' collegata NON si
// ripiega sulla webcam integrata. Restituisce true se la webcam e' attiva.
async function startCamera({ announce = true } = {}) {
    if (isRunning) {
        return true;
    }

    ensureAudioContext();
    loadingOverlay.classList.add('active');
    cameraState.textContent = 'Avvio webcam USB in corso';
    startBtn.disabled = true;
    startBtn.textContent = 'Avvio webcam...';

    try {
        camera = await RicFaccWebcam.start(videoElement, async () => {
            await faceMesh.send({ image: videoElement });
        }, { width: 640, height: 480, onEnded: handleCameraDisconnected });

        isRunning = true;
        cameraState.textContent = `Webcam USB attiva: ${camera.label}`;
        startBtn.textContent = 'Webcam attiva';
        logEvent(`Webcam USB attivata correttamente: ${camera.label}.`);
        if (announce) {
            speakText('Webcam attiva. Il sistema e pronto per il test.', { interrupt: true, rate: 1.03 });
        }
        return true;
    } catch (error) {
        console.error('Errore webcam:', error);
        camera = null;
        const notConnected = Boolean(error) && error.code === RicFaccWebcam.ERR_NO_EXTERNAL;
        cameraState.textContent = notConnected ? 'Webcam USB esterna non collegata' : 'Errore accesso webcam';
        startBtn.disabled = false;
        startBtn.textContent = 'Riprova webcam';
        loadingOverlay.classList.remove('active');
        if (notConnected) {
            logEvent('Webcam USB esterna non rilevata: collegarla al PC e riprovare.');
        } else {
            logEvent('Errore nell accesso alla webcam.');
            alert('Impossibile accedere alla webcam. Verifica i permessi del browser.');
        }
        return false;
    }
}

// La webcam USB e' stata scollegata mentre era in uso.
function handleCameraDisconnected() {
    camera = null;
    isRunning = false;
    lastFaceDetected = false;
    latestFraming = createEmptyFraming(false);
    cameraState.textContent = 'Webcam USB scollegata';
    startBtn.disabled = false;
    startBtn.textContent = 'Riavvia webcam';
    loadingOverlay.classList.remove('active');
    updateChoiceMachine(latestEarLeft, latestEarRight, latestMar, false);
    logEvent('Webcam USB scollegata: ricollegarla e riavviare la webcam.');
    speakText('Webcam scollegata. Controlla il cavo USB.', { interrupt: true, rate: 1.02 });
}

async function stopCamera() {
    if (!isRunning) {
        return;
    }
    try {
        if (camera) {
            await camera.stop();
        }
    } catch (error) {
        console.warn('Errore durante lo stop della webcam:', error);
    }
    camera = null;
    isRunning = false;
    lastFaceDetected = false;
    latestFraming = createEmptyFraming(false);
    cameraState.textContent = 'Webcam non avviata';
    startBtn.disabled = false;
    startBtn.textContent = 'Avvia webcam';
    loadingOverlay.classList.remove('active');
    logEvent('Webcam disattivata.');
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
        if (focusedIndex < 0) {
            focusedIndex = 0;
            updateStateUI();
        }
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
    logEvent('Avvio demo automatica del processo di risposta.');
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

startBtn.addEventListener('click', () => {
    document.documentElement.requestFullscreen().catch(() => {});
    startCamera();
});
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
        const imageInfo = describeQuestionImages(questions);
        applyImportedQuestions(questions, file.name);
        if (imageInfo.warnings) {
            updateImportStatus(`Attenzione immagini: ${imageInfo.warnings}`, true);
            logEvent(`Attenzione immagini: ${imageInfo.warnings}`);
        }
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

// Schermata iniziale: il file delle domande si carica da qui prima di accedere al quiz.
async function loadQuestionFileFromGate(file) {
    gateLoadFileBtn.disabled = true;
    setGateFileStatus(`Lettura di ${file.name} in corso...`);

    try {
        const questions = await parseQuestionFile(file);
        publishQuestionBatchNow(questions, 'PC studente', currentQuizSession.subject);
        const imageInfo = describeQuestionImages(questions);
        const loadedMessage = `Caricato: ${file.name} (${questionSet.length} domande${imageInfo.summary})`;
        updateImportStatus(loadedMessage);
        setGateFileStatus(loadedMessage);
        if (imageInfo.warnings) {
            logEvent(`Attenzione immagini: ${imageInfo.warnings}`);
        }
        await startQuizAfterPublish();
    } catch (error) {
        console.error('Errore importazione test:', error);
        setGateFileStatus(`File non valido: ${error.message}`, true);
        logEvent(`Import fallito: ${error.message}`);
    } finally {
        gateLoadFileBtn.disabled = false;
        gateFileInput.value = '';
    }
}

gateLoadFileBtn.addEventListener('click', () => {
    gateFileInput.click();
});

gateFileInput.addEventListener('change', () => {
    const file = gateFileInput.files && gateFileInput.files[0];
    if (file) {
        void loadQuestionFileFromGate(file);
    }
});

window.addEventListener('beforeunload', () => {
    if (remoteStateTimer) {
        window.clearInterval(remoteStateTimer);
    }
    if (remoteCommandTimer) {
        window.clearInterval(remoteCommandTimer);
    }
    if (debugChannel) {
        debugChannel.close();
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

setupDebugBridge();
resetCurrentFlow(true);
setQuestionFileGate(true);
RicFaccWebcam.mountPicker(gateCameraPicker);
logEvent('Profilo calibrato caricato: EAR 0.13, MAR 0.17, occhiali attivi.');
setCommandState('In attesa');
startRemoteSync();

examStarted = true;
setCommandState('In attesa');

let suspendedSessionData = null;

async function checkSuspendedQuizSession() {
    try {
        const studentInfo = await fetchJson('/api/student/info');
        if (studentInfo && studentInfo.activeStudent) {
            currentQuizSession.student = studentInfo.activeStudent;
        }
        if (studentInfo && studentInfo.activeSubject) {
            currentQuizSession.subject = studentInfo.activeSubject;
        }

        const data = await fetchJson('/api/quiz/active-session');
        if (data && data.session && Array.isArray(data.session.domande) && data.session.domande.length > 0) {
            suspendedSessionData = data.session;
            showSuspendedModal(data.session);
        }
    } catch (e) {
        console.warn('Controllo sessione sospesa fallito:', e);
    }
}

function showSuspendedModal(session) {
    const modal = document.getElementById('studentSuspendedModal');
    if (!modal) return;

    const subjectSpan = document.getElementById('suspendedModalSubject');
    const dateSpan = document.getElementById('suspendedModalDate');
    const progressSpan = document.getElementById('suspendedModalProgress');
    const scoreSpan = document.getElementById('suspendedModalScore');

    if (subjectSpan) subjectSpan.textContent = session.materia || 'Quiz';
    if (dateSpan) dateSpan.textContent = session.dataInizio || session.data || '-';
    const totalQ = session.totaleDomande || session.domande?.length || 0;
    const answeredCount = Array.isArray(session.answers) ? session.answers.filter(Boolean).length : 0;
    if (progressSpan) progressSpan.textContent = `${answeredCount} di ${totalQ} risposte fornite (prossima: domanda ${(session.currentQuestionIndex || 0) + 1})`;
    if (scoreSpan && session.score) {
        scoreSpan.textContent = `${session.score.esatte || 0} esatte, ${session.score.errate || 0} errate (${session.score.percentuale || 0}%)`;
    }

    modal.classList.remove('hidden');
}

function initSuspendedModalHandlers() {
    const resumeBtn = document.getElementById('resumeSuspendedBtn');
    const restartBtn = document.getElementById('restartSuspendedBtn');
    const newBtn = document.getElementById('newSuspendedBtn');

    if (resumeBtn) {
        resumeBtn.addEventListener('click', async () => {
            if (suspendedSessionData) {
                resumeQuizSession(suspendedSessionData);
                try {
                    await fetchJson('/api/quiz/session-action', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'resume' })
                    });
                } catch (e) {}
                hideSuspendedBanner();
            }
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', async () => {
            if (suspendedSessionData) {
                restartQuizSession(suspendedSessionData);
                try {
                    await fetchJson('/api/quiz/session-action', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'restart' })
                    });
                } catch (e) {}
                hideSuspendedBanner();
            }
        });
    }

    if (newBtn) {
        newBtn.addEventListener('click', async () => {
            try {
                await fetchJson('/api/quiz/session-action', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'new' })
                });
            } catch (e) {}
            hideSuspendedBanner();
            resetCurrentFlow(true);
            logEvent('Sessione sospesa archiviata. Pronto per un nuovo test.');
            speakText('Pronto per un nuovo test.', { interrupt: true, rate: 1.02 });
        });
    }
}

initSuspendedModalHandlers();
void checkSuspendedQuizSession();











