/*
 * Ric_Facc - webcam ESTERNA collegata via USB
 *
 * Modulo condiviso da index.html (quiz studente) e comunicatore.html.
 * Il tracking facciale deve usare una webcam esterna USB, non quella del portatile:
 *  - elenca le videocamere del PC e distingue quelle integrate/virtuali dalle esterne;
 *  - usa la prima webcam esterna trovata, oppure quella scelta a mano dall'operatore
 *    (memorizzata nel browser);
 *  - se non c'e' nessuna webcam esterna NON ripiega sulla webcam integrata:
 *    segnala "webcam USB non collegata" (errore con code = NO_EXTERNAL_CAMERA);
 *  - apre il flusso con il deviceId scelto e invia i frame a MediaPipe.
 *
 * Il browser non espone il tipo di collegamento (USB o interno): la distinzione si
 * basa sul nome della periferica, per questo resta sempre possibile scegliere a mano.
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'ricFaccCameraDeviceId';
    const ERR_NO_EXTERNAL = 'NO_EXTERNAL_CAMERA';

    // Nomi tipici delle webcam integrate nei portatili e delle webcam virtuali.
    const NOT_EXTERNAL_PATTERN = /integrat|incorporat|built[\s-]?in|internal|facetime|user[\s-]?facing|\bfront\b|infrared|\bir\b|windows hello|easycamera|virtual|\bobs\b|manycam|xsplit|snap camera/i;

    function createError(code, message) {
        const error = new Error(message);
        error.code = code;
        return error;
    }

    function readPreferredId() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) || '';
        } catch (error) {
            return '';
        }
    }

    function savePreferredId(deviceId) {
        try {
            if (deviceId) {
                window.localStorage.setItem(STORAGE_KEY, deviceId);
            } else {
                window.localStorage.removeItem(STORAGE_KEY);
            }
        } catch (error) {
            // localStorage non disponibile: la scelta vale solo per questa sessione.
        }
    }

    function ensureMediaDevices() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || !navigator.mediaDevices.getUserMedia) {
            throw createError('NO_MEDIA_DEVICES', 'Il browser non consente l\'accesso alla webcam (serve http://localhost o https).');
        }
    }

    async function enumerateCameras() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'videoinput');
    }

    // Elenco delle videocamere. Senza permesso il browser non rivela i nomi: in quel caso
    // si apre e chiude subito una webcam per ottenere il permesso e leggere le etichette.
    async function listCameras() {
        ensureMediaDevices();

        let devices = await enumerateCameras();
        if (devices.length > 0 && devices.some((device) => !device.label)) {
            const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            probe.getTracks().forEach((track) => track.stop());
            devices = await enumerateCameras();
        }

        return devices.map((device, index) => {
            const label = device.label || `Webcam ${index + 1}`;
            return {
                deviceId: device.deviceId,
                label,
                external: !NOT_EXTERNAL_PATTERN.test(label)
            };
        });
    }

    // Sceglie la webcam da usare: prima quella impostata a mano, poi la prima esterna.
    function chooseCamera(cameras) {
        const preferredId = readPreferredId();
        const preferred = preferredId ? cameras.find((camera) => camera.deviceId === preferredId) : null;
        if (preferred) {
            return { camera: preferred, manual: true };
        }
        const external = cameras.find((camera) => camera.external);
        return { camera: external || null, manual: false };
    }

    function startFrameLoop(video, onFrame) {
        let active = true;
        let busy = false;
        let requestId = 0;

        const tick = async () => {
            if (!active) {
                return;
            }
            if (!busy && video.readyState >= 2) {
                busy = true;
                try {
                    await onFrame();
                } catch (error) {
                    console.error('Errore elaborazione frame webcam:', error);
                } finally {
                    busy = false;
                }
            }
            if (active) {
                requestId = window.requestAnimationFrame(tick);
            }
        };

        requestId = window.requestAnimationFrame(tick);
        return () => {
            active = false;
            window.cancelAnimationFrame(requestId);
        };
    }

    /*
     * Avvia la webcam esterna e chiama onFrame a ogni fotogramma.
     * Restituisce { label, deviceId, stop() }; onEnded viene chiamato se la webcam
     * viene scollegata mentre e' in uso.
     */
    async function start(video, onFrame, { width = 640, height = 480, onEnded = null } = {}) {
        const cameras = await listCameras();
        const { camera } = chooseCamera(cameras);

        if (!camera) {
            throw createError(
                ERR_NO_EXTERNAL,
                cameras.length > 0
                    ? 'Nessuna webcam USB esterna rilevata: e\' presente solo la webcam integrata.'
                    : 'Nessuna webcam rilevata: collega la webcam USB al PC.'
            );
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                deviceId: { exact: camera.deviceId },
                width: { ideal: width },
                height: { ideal: height }
            }
        });

        video.srcObject = stream;
        try {
            await video.play();
        } catch (error) {
            console.warn('Riproduzione video webcam non avviata subito:', error);
        }

        let stopped = false;
        const stopLoop = startFrameLoop(video, onFrame);

        const release = () => {
            if (stopped) {
                return;
            }
            stopped = true;
            stopLoop();
            stream.getTracks().forEach((track) => track.stop());
            if (video.srcObject === stream) {
                video.srcObject = null;
            }
        };

        const track = stream.getVideoTracks()[0];
        if (track) {
            track.addEventListener('ended', () => {
                if (stopped) {
                    return;
                }
                release();
                if (typeof onEnded === 'function') {
                    onEnded();
                }
            });
        }

        return {
            label: camera.label,
            deviceId: camera.deviceId,
            stop: async () => release()
        };
    }

    // ------------------------------------------------------------------
    // Selettore webcam (stato + scelta manuale) da inserire nelle schermate di avvio
    // ------------------------------------------------------------------
    let stylesInjected = false;

    function injectStyles() {
        if (stylesInjected) {
            return;
        }
        stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
.ricfacc-cam { display: grid; gap: 10px; margin: 0 0 20px; text-align: left; }
.ricfacc-cam__status { padding: 12px 16px; border-radius: 14px; font-size: 1rem; font-weight: 700; line-height: 1.4; color: #f5f8ff; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16); }
.ricfacc-cam__status--ok { color: #71f79f; border-color: rgba(113, 247, 159, 0.5); }
.ricfacc-cam__status--warn { color: #ffd166; border-color: rgba(255, 209, 102, 0.55); }
.ricfacc-cam__status--error { color: #ff9b9b; border-color: rgba(255, 107, 107, 0.55); }
.ricfacc-cam__field { display: grid; gap: 6px; font-size: 0.9rem; color: #9cb3d9; }
.ricfacc-cam__field select { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.2); background: #0a1424; color: #f5f8ff; font: inherit; }
.ricfacc-cam__field select:disabled { opacity: 0.6; }
`;
        document.head.appendChild(style);
    }

    function mountPicker(container, { onChange = null } = {}) {
        injectStyles();
        container.classList.add('ricfacc-cam');
        container.textContent = '';

        const status = document.createElement('p');
        status.className = 'ricfacc-cam__status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        const field = document.createElement('label');
        field.className = 'ricfacc-cam__field';
        const caption = document.createElement('span');
        caption.textContent = 'Webcam da usare';
        const select = document.createElement('select');
        field.append(caption, select);

        container.append(status, field);

        function setStatus(text, level) {
            status.textContent = text;
            status.className = `ricfacc-cam__status ricfacc-cam__status--${level}`;
        }

        function fillSelect(cameras, preferredId) {
            select.textContent = '';

            const auto = document.createElement('option');
            auto.value = '';
            auto.textContent = 'Automatica (webcam USB esterna)';
            select.appendChild(auto);

            cameras.forEach((camera) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.external ? camera.label : `${camera.label} (integrata o virtuale)`;
                select.appendChild(option);
            });

            const hasPreferred = cameras.some((camera) => camera.deviceId === preferredId);
            select.value = hasPreferred ? preferredId : '';
            select.disabled = cameras.length === 0;
        }

        async function refresh() {
            let cameras = [];
            try {
                cameras = await listCameras();
            } catch (error) {
                console.warn('Elenco webcam non disponibile:', error);
                fillSelect([], '');
                setStatus(
                    error && error.code === 'NO_MEDIA_DEVICES'
                        ? error.message
                        : 'Permesso webcam negato o webcam non accessibile: controlla i permessi del browser.',
                    'error'
                );
                return;
            }

            fillSelect(cameras, readPreferredId());
            const { camera, manual } = chooseCamera(cameras);

            if (camera) {
                setStatus(
                    manual ? `Webcam selezionata: ${camera.label}` : `Webcam USB esterna pronta: ${camera.label}`,
                    'ok'
                );
            } else if (cameras.length > 0) {
                const names = cameras.map((item) => item.label).join(', ');
                setStatus(`Webcam USB esterna non rilevata (trovata solo: ${names}). Collega la webcam USB al PC.`, 'warn');
            } else {
                setStatus('Nessuna webcam rilevata. Collega la webcam USB al PC.', 'warn');
            }
        }

        select.addEventListener('change', () => {
            savePreferredId(select.value);
            void refresh();
            if (typeof onChange === 'function') {
                onChange(select.value);
            }
        });

        // Aggiorna da solo quando la webcam viene collegata o scollegata.
        if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                void refresh();
            });
        }

        setStatus('Ricerca della webcam USB in corso...', 'warn');
        void refresh();

        return { refresh };
    }

    window.RicFaccWebcam = {
        ERR_NO_EXTERNAL,
        listCameras,
        chooseCamera,
        start,
        mountPicker
    };
})();
