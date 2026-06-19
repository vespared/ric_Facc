/* =====================================================================
   COMUNICATORE ALFABETICO — sessione autonoma (separata dal sistema esame)
   Stessa modalita di selezione del quiz Ric_Facc:
   - bocca aperta (MAR > soglia)  -> SCORRI: sposta l'evidenziatore in ciclo
   - occhi chiusi (EAR < soglia) tenuti ~1s -> SCEGLI: attiva il riquadro
   Pipeline di face-tracking MediaPipe FaceMesh indipendente da app.js.
   ===================================================================== */

const CONFIG = {
    earThreshold: 0.13,
    marThreshold: 0.17,
    glassesMode: true,
    earBufferSize: 15,
    scrollActivationMs: 300,
    scrollCooldownMs: 1000,
    selectHoldMs: 1000
};

const LEFT_EYE = [362, 385, 387, 263, 373, 380];
const RIGHT_EYE = [33, 160, 158, 133, 153, 144];

// ---------------------------------------------------------------------
// Tracking: metriche EAR / MAR (identiche al quiz)
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// Sintesi vocale italiana (stessa logica del quiz)
// ---------------------------------------------------------------------
function scoreItalianVoice(voice) {
    const name = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    const lang = (voice.lang || '').toLowerCase();
    if (!lang.startsWith('it')) {
        return -1000;
    }
    let score = 0;
    if (lang === 'it-it') score += 20;
    if (name.includes('natural') || name.includes('online')) score += 80;
    if (name.includes('elsa') || name.includes('isabella') || name.includes('alice')
        || name.includes('federica') || name.includes('lucia') || name.includes('giulia')) score += 45;
    if (name.includes('female') || name.includes('woman') || name.includes('donna')) score += 30;
    if (name.includes('diego') || name.includes('cosimo') || name.includes('male') || name.includes('uomo')) score -= 60;
    if (name.includes('microsoft')) score += 12;
    else if (name.includes('google')) score += 8;
    return score;
}

let italianVoice = null;
function refreshItalianVoice() {
    if (!('speechSynthesis' in window)) {
        return;
    }
    const voices = window.speechSynthesis.getVoices();
    italianVoice = voices
        .filter((voice) => voice.lang && voice.lang.toLowerCase().startsWith('it'))
        .sort((left, right) => scoreItalianVoice(right) - scoreItalianVoice(left))[0] || null;
}

function speak(text, rate = 1.0) {
    if (!commAudioOn || !('speechSynthesis' in window)) {
        return;
    }
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(text));
        utterance.lang = 'it-IT';
        utterance.rate = rate;
        if (italianVoice) {
            utterance.voice = italianVoice;
        }
        window.speechSynthesis.speak(utterance);
    } catch (error) {
        // ignore
    }
}

// ---------------------------------------------------------------------
// Suoni di feedback (chime scroll / select)
// ---------------------------------------------------------------------
let audioContext = null;
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
    }
}

// ---------------------------------------------------------------------
// Modello dei gruppi / riquadri (portato da SistemCO)
// ---------------------------------------------------------------------
const COMM_GROUPS = [
    {
        id: 'VOWELS', cls: 'vowel', type: 'vowel', title: 'VOCALI', sub: 'A E I O U', cols: 5,
        items: 'AEIOU'.split('').map((k) => ({ k }))
    },
    {
        id: 'CONS1', cls: 'cons', type: 'consonant', title: 'CONSONANTI 1', sub: 'Q W R T Y P', cols: 6,
        items: 'QWRTYP'.split('').map((k) => ({ k }))
    },
    {
        id: 'CONS2', cls: 'cons', type: 'consonant', title: 'CONSONANTI 2', sub: 'S D F G H J K L', cols: 4,
        items: 'SDFGHJKL'.split('').map((k) => ({ k }))
    },
    {
        id: 'CONS3', cls: 'cons', type: 'consonant', title: 'CONSONANTI 3', sub: 'Z X C V B N M', cols: 4,
        items: 'ZXCVBNM'.split('').map((k) => ({ k }))
    },
    {
        id: 'NUM', cls: 'num', type: 'num', title: 'NUMERI', sub: '1 2 3 … 0', cols: 5,
        items: '1234567890'.split('').map((k) => ({ k }))
    },
    {
        id: 'ACT', cls: 'action', type: 'action', title: 'AZIONI', sub: 'SPAZIO · SÌ · NO · CANCELLA', cols: 3,
        items: [
            { k: 'SPACE', label: 'SPAZIO ⎵', cls: 'space' },
            { k: 'DEL', label: '⌫ CANCELLA', cls: 'del' },
            { k: 'READ', label: '▶ LEGGI', cls: 'read' },
            { k: 'YES', label: 'SÌ', cls: 'yes' },
            { k: 'NO', label: 'NO', cls: 'no' },
            { k: 'CLEAR', label: 'PULISCI', cls: 'clear' }
        ]
    }
];

// ---------------------------------------------------------------------
// Elementi e stato
// ---------------------------------------------------------------------
const startOverlay = document.getElementById('commStart');
const startBtn = document.getElementById('commStartBtn');
const startStatus = document.getElementById('commStartStatus');
const commGroupsEl = document.getElementById('commGroups');
const commPanelsEl = document.getElementById('commPanels');
const commPhraseText = document.getElementById('commPhraseText');
const commPhrasePh = document.getElementById('commPhrasePh');
const commAudioBtn = document.getElementById('commAudioBtn');
const commExitBtn = document.getElementById('commExitBtn');
const hudVideo = document.querySelector('.comm-hud__video');
const hudState = document.getElementById('commHudState');
const hudEar = document.getElementById('commHudEar');
const hudMar = document.getElementById('commHudMar');

let commPanelEls = [];
let commLevel = 'groups';
let commFocusIndex = -1;
let commText = '';
let commProgress = 0;
let commAudioOn = true;
let commActivating = false;
let commRunning = false;

let mouthStartedAt = null;
let mouthLocked = false;
let lastScrollAt = 0;
let eyeStartedAt = null;

const leftEarBuffer = [];
const rightEarBuffer = [];

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------
function commRenderBoard() {
    commGroupsEl.innerHTML = COMM_GROUPS.map((g) => `
        <div data-comm-tile data-role="group" data-group="${g.id}" class="comm-tile comm-tile--group comm-tile--${g.cls}">
            <div class="comm-fill"></div>
            <div class="comm-glyph comm-glyph--group">
                <span class="comm-group-title">${g.title}</span>
                <span class="comm-group-sub">${g.sub}</span>
            </div>
        </div>`).join('');

    commPanelsEl.innerHTML = COMM_GROUPS.map((g) => `
        <div class="comm-panel comm-hidden" data-group="${g.id}">
            <div data-comm-tile data-role="back" class="comm-tile comm-tile--back">
                <div class="comm-fill"></div>
                <span class="comm-glyph">◀ INDIETRO &nbsp;·&nbsp; ${g.title}</span>
            </div>
            <div class="comm-grid comm-grid--${g.cols}">
                ${g.items.map((it) => `
                    <div data-comm-tile data-role="item" data-key="${it.k}" data-type="${it.type || g.type}"
                         class="comm-tile comm-tile--item comm-tile--${it.cls || g.cls}">
                        <div class="comm-fill"></div>
                        <span class="comm-glyph">${it.label || it.k}</span>
                    </div>`).join('')}
            </div>
        </div>`).join('');

    commPanelEls = Array.from(commPanelsEl.querySelectorAll('.comm-panel'));

    // Click/tap come scorciatoia (test e supporto)
    commGroupsEl.querySelectorAll('[data-comm-tile]').forEach(wireTileClick);
    commPanelsEl.querySelectorAll('[data-comm-tile]').forEach(wireTileClick);
}

function wireTileClick(tile) {
    tile.addEventListener('click', () => {
        const tiles = currentTiles();
        const idx = tiles.indexOf(tile);
        if (idx < 0) {
            return;
        }
        commFocusIndex = idx;
        syncFocus();
        activateFocused('Tocco');
    });
}

function currentTiles() {
    if (commLevel === 'groups') {
        return Array.from(commGroupsEl.querySelectorAll('[data-comm-tile]'));
    }
    const panel = commPanelEls.find((p) => p.dataset.group === commLevel);
    return panel ? Array.from(panel.querySelectorAll('[data-comm-tile]')) : [];
}

function tileLabel(tile) {
    if (!tile) {
        return '';
    }
    const role = tile.dataset.role;
    if (role === 'group') {
        const g = COMM_GROUPS.find((x) => x.id === tile.dataset.group);
        return g ? g.title : '';
    }
    if (role === 'back') {
        return 'indietro';
    }
    const key = tile.dataset.key;
    const labels = { SPACE: 'spazio', DEL: 'cancella', READ: 'leggi', YES: 'sì', NO: 'no', CLEAR: 'pulisci tutto' };
    return labels[key] || key;
}

function setProgress(p) {
    commProgress = p;
    const tile = currentTiles()[commFocusIndex];
    if (tile) {
        const fill = tile.querySelector('.comm-fill');
        if (fill) {
            fill.style.height = `${(p * 100).toFixed(1)}%`;
        }
    }
}

function syncFocus() {
    const tiles = currentTiles();
    tiles.forEach((tile, i) => {
        const focused = i === commFocusIndex;
        tile.classList.toggle('is-focused', focused);
        const fill = tile.querySelector('.comm-fill');
        if (fill && !tile.classList.contains('is-activated')) {
            fill.style.height = focused ? `${(commProgress * 100).toFixed(1)}%` : '0%';
        }
    });
}

function openLevel(level) {
    commLevel = level;
    commFocusIndex = -1;
    commProgress = 0;
    eyeStartedAt = null;
    mouthLocked = false;
    if (level === 'groups') {
        commGroupsEl.classList.remove('comm-hidden');
        commPanelEls.forEach((p) => p.classList.add('comm-hidden'));
    } else {
        commGroupsEl.classList.add('comm-hidden');
        commPanelEls.forEach((p) => p.classList.toggle('comm-hidden', p.dataset.group !== level));
    }
    syncFocus();
}

function renderPhrase() {
    if (!commText) {
        commPhraseText.textContent = '';
        commPhrasePh.style.display = 'inline';
    } else {
        commPhrasePh.style.display = 'none';
        commPhraseText.textContent = commText.length > 70 ? `…${commText.slice(-70)}` : commText;
    }
}

function addChar(ch) {
    commText += ch;
    renderPhrase();
}

function addWord(w) {
    if (commText && !/\s$/.test(commText)) {
        commText += ' ';
    }
    commText += `${w} `;
    renderPhrase();
}

function handleKey(key, type) {
    if (type === 'vowel' || type === 'consonant' || type === 'num') {
        addChar(key);
        speak(key);
        return;
    }
    switch (key) {
        case 'SPACE': {
            const word = commText.trim().split(/\s+/).pop();
            addChar(' ');
            if (word) {
                speak(word);
            }
            break;
        }
        case 'DEL':
            commText = commText.slice(0, -1);
            renderPhrase();
            break;
        case 'CLEAR':
            commText = '';
            renderPhrase();
            break;
        case 'READ':
            if (commText.trim()) {
                speak(commText.trim(), 0.98);
            }
            break;
        case 'YES':
            addWord('SÌ');
            speak('sì');
            break;
        case 'NO':
            addWord('NO');
            speak('no');
            break;
        default:
            break;
    }
}

function setHudState(label) {
    if (hudState) {
        hudState.textContent = label;
    }
}

// ---------------------------------------------------------------------
// Macchina a scansione
// ---------------------------------------------------------------------
function commScroll() {
    if (commActivating) {
        return;
    }
    const tiles = currentTiles();
    if (!tiles.length) {
        return;
    }
    playChime('scroll');
    commProgress = 0;
    if (commFocusIndex < 0) {
        commFocusIndex = 0;
    } else {
        commFocusIndex = (commFocusIndex + 1) % tiles.length;
    }
    syncFocus();
    const label = tileLabel(tiles[commFocusIndex]);
    setHudState(`▶ ${label}`);
    speak(label, 1.06);
}

function activateFocused() {
    if (commActivating) {
        return;
    }
    const tile = currentTiles()[commFocusIndex];
    if (!tile) {
        return;
    }
    commActivating = true;
    eyeStartedAt = null;
    commProgress = 0;
    tile.classList.add('is-activated');
    playChime('select');
    window.setTimeout(() => tile.classList.remove('is-activated'), 380);

    const role = tile.dataset.role;
    if (role === 'group') {
        openLevel(tile.dataset.group);
        commActivating = false;
        return;
    }
    if (role === 'back') {
        openLevel('groups');
        commActivating = false;
        return;
    }
    handleKey(tile.dataset.key, tile.dataset.type);
    window.setTimeout(() => {
        openLevel('groups');
        commActivating = false;
    }, 300);
}

function processMouth(mouthOpen) {
    const now = performance.now();
    if (!mouthOpen) {
        mouthStartedAt = null;
        mouthLocked = false;
        return;
    }
    if (mouthLocked) {
        return;
    }
    if (mouthStartedAt === null) {
        mouthStartedAt = now;
        setHudState('Bocca rilevata');
        return;
    }
    if (now - mouthStartedAt >= CONFIG.scrollActivationMs && now - lastScrollAt >= CONFIG.scrollCooldownMs) {
        mouthLocked = true;
        lastScrollAt = now;
        commScroll();
    }
}

function processEyes(eyesClosed) {
    const now = performance.now();
    if (!eyesClosed) {
        if (eyeStartedAt !== null) {
            eyeStartedAt = null;
            setProgress(0);
        }
        return;
    }
    if (commFocusIndex < 0 || commActivating) {
        return;
    }
    if (eyeStartedAt === null) {
        eyeStartedAt = now;
    }
    const progress = Math.min(1, (now - eyeStartedAt) / CONFIG.selectHoldMs);
    setProgress(progress);
    setHudState(`Scelta ${Math.round(progress * 100)}%`);
    if (progress >= 1) {
        eyeStartedAt = null;
        activateFocused();
    }
}

function onResults(results) {
    if (!commRunning) {
        return;
    }
    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    if (!hasFace) {
        mouthStartedAt = null;
        mouthLocked = false;
        if (eyeStartedAt !== null) {
            eyeStartedAt = null;
            setProgress(0);
        }
        setHudState('Volto non rilevato');
        return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    let rightEar = calculateEAR(RIGHT_EYE, landmarks);
    let leftEar = calculateEAR(LEFT_EYE, landmarks);
    if (CONFIG.glassesMode) {
        rightEar = smoothValue(rightEar, rightEarBuffer);
        leftEar = smoothValue(leftEar, leftEarBuffer);
    }
    const mar = calculateMAR(landmarks);

    if (hudEar) hudEar.textContent = ((leftEar + rightEar) / 2).toFixed(3);
    if (hudMar) hudMar.textContent = mar.toFixed(3);

    const eyesClosed = leftEar < CONFIG.earThreshold && rightEar < CONFIG.earThreshold;
    const mouthOpen = mar > CONFIG.marThreshold;
    processMouth(mouthOpen);
    processEyes(eyesClosed);
}

// ---------------------------------------------------------------------
// Avvio webcam + FaceMesh
// ---------------------------------------------------------------------
let faceMesh = null;
let camera = null;

async function startCommunicator() {
    if (commRunning) {
        return;
    }
    ensureAudioContext();
    startBtn.disabled = true;
    startStatus.classList.remove('is-error');
    startStatus.textContent = 'Avvio webcam in corso…';

    try {
        faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        faceMesh.onResults(onResults);

        camera = new Camera(hudVideo, {
            onFrame: async () => {
                await faceMesh.send({ image: hudVideo });
            },
            width: 640,
            height: 480
        });
        await camera.start();

        commRunning = true;
        startOverlay.classList.add('is-hidden');
        document.documentElement.requestFullscreen().catch(() => {});
        openLevel('groups');
        setHudState('Pronto');
        speak('Comunicatore attivo. Apri la bocca per scorrere, chiudi gli occhi per scegliere.', 1.02);
    } catch (error) {
        console.error('Errore webcam:', error);
        startBtn.disabled = false;
        startStatus.classList.add('is-error');
        startStatus.textContent = 'Impossibile accedere alla webcam. Controlla i permessi del browser e riprova.';
    }
}

function exitCommunicator() {
    try {
        window.speechSynthesis.cancel();
    } catch (error) {
        // ignore
    }
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    startBtn.disabled = false;
    startStatus.classList.remove('is-error');
    startStatus.textContent = 'Sessione in pausa. Premi Avvia per riprendere.';
    startOverlay.classList.remove('is-hidden');
    setHudState('In pausa');
    // La webcam resta attiva ma i comandi sono ignorati finche non si riavvia.
    commRunning = false;
    commText = '';
    renderPhrase();
    openLevel('groups');
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------
function updateAudioBtn() {
    commAudioBtn.textContent = commAudioOn ? 'AUDIO ON' : 'AUDIO OFF';
    commAudioBtn.classList.toggle('is-off', !commAudioOn);
}

commRenderBoard();
renderPhrase();
openLevel('groups');
updateAudioBtn();
refreshItalianVoice();

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = refreshItalianVoice;
}

startBtn.addEventListener('click', startCommunicator);
commExitBtn.addEventListener('click', exitCommunicator);

commAudioBtn.addEventListener('click', () => {
    commAudioOn = !commAudioOn;
    if (!commAudioOn) {
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            // ignore
        }
    }
    updateAudioBtn();
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && commRunning) {
        exitCommunicator();
    }
});

window.addEventListener('beforeunload', () => {
    if (camera) {
        try {
            camera.stop();
        } catch (error) {
            // ignore
        }
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
});
