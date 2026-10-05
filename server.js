const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const AUTO_OPEN_STUDENT = process.env.AUTO_OPEN_STUDENT === '1' ||
    process.env.AUTO_OPEN_STUDENT !== '0' ||
    process.argv.includes('--auto-open-student');

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
};

const STUDENTS_BASE_DIR = path.join(ROOT_DIR, 'studenti');
if (!fs.existsSync(STUDENTS_BASE_DIR)) {
    try {
        fs.mkdirSync(STUDENTS_BASE_DIR, { recursive: true });
    } catch (e) {
        console.error('[server] Errore creazione cartella studenti:', e.message);
    }
}

const state = {
    studentSnapshot: null,
    studentUpdatedAt: null,
    commands: [],
    nextCommandId: 1,
    latestAckedCommandId: 0,
    lastStudentAck: null,
    lastTeacherPing: 0,
    studentBrowserOpened: false,
    activeStudent: 'Martinelli',
    activeSubject: 'Italiano'
};

function sanitizeName(name) {
    const clean = String(name || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/^_+|_+$/g, '');
    return clean || 'Martinelli';
}

function getStudentDir(name) {
    const dir = path.join(STUDENTS_BASE_DIR, sanitizeName(name));
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

getStudentDir('Martinelli');

function formatDateItalian(d) {
    const date = (d instanceof Date && !isNaN(d.getTime())) ? d : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function formatDateFile(d) {
    const date = (d instanceof Date && !isNaN(d.getTime())) ? d : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generatePrintableHtml(quizData, options = {}) {
    const student = escapeHtml(quizData.studente || 'Studente');
    const subject = escapeHtml(quizData.materia || 'Quiz');
    const isTotal = quizData.tipoRisultato === 'totale' || quizData.stato === 'completato';
    const badgeClass = isTotal ? 'badge-totale' : 'badge-parziale';
    const badgeText = isTotal ? 'Test Concluso (Totale)' : 'Test in Corso (Parziale)';
    const dateFormatted = escapeHtml(quizData.data || formatDateItalian(new Date(quizData.dataIso || Date.now())));
    const completionFormatted = quizData.dataCompletamento ? escapeHtml(quizData.dataCompletamento) : dateFormatted;

    const totalQuestions = quizData.totaleDomande || (quizData.domande ? quizData.domande.length : 0);
    const score = quizData.punteggio || { esatte: 0, errate: 0, libere: 0, totaleRisposte: 0, percentuale: 0 };
    const pct = typeof score.percentuale === 'number' ? score.percentuale : Math.round(((score.esatte || 0) / (totalQuestions || 1)) * 100);

    const questionsHtml = (quizData.domande || []).map((q, idx) => {
        const studentAns = (quizData.answers || []).find((a) => a && (a.questionIndex === idx || a.title === q.title))
            || (quizData.answers && quizData.answers[idx]);

        const title = escapeHtml(q.title || `Domanda ${idx + 1}`);
        const prompt = escapeHtml(q.prompt || '');
        const optionsList = Array.isArray(q.options) ? q.options : [];
        const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : null;

        let evalPill = '';
        if (studentAns) {
            if (studentAns.outcome === 'correct' || studentAns.isCorrect === true) {
                evalPill = '<span class="answer-evaluation-pill pill-correct">&#10003; RISPOSTA DELLO STUDENTE: CORRETTA</span>';
            } else if (studentAns.outcome === 'wrong' || studentAns.isCorrect === false) {
                evalPill = '<span class="answer-evaluation-pill pill-wrong">&#10007; RISPOSTA DELLO STUDENTE: ERRATA</span>';
            } else {
                evalPill = '<span class="answer-evaluation-pill pill-free">&#10022; SCELTA REGISTRATA</span>';
            }
        } else {
            evalPill = '<span class="answer-evaluation-pill pill-unanswered">&#9675; NON ANCORA RISPOSTA (Sospeso)</span>';
        }

        const optionsHtml = optionsList.map((opt, optIdx) => {
            const letter = ['A', 'B', 'C', 'D'][optIdx] || String(optIdx + 1);
            const isStudentChoice = studentAns && (studentAns.selectedIndex === optIdx);
            let choiceClass = '';
            if (isStudentChoice) {
                choiceClass = 'is-student-choice';
                if (studentAns.outcome === 'correct' || studentAns.isCorrect === true) {
                    choiceClass += ' choice-correct';
                } else if (studentAns.outcome === 'wrong' || studentAns.isCorrect === false) {
                    choiceClass += ' choice-wrong';
                } else {
                    choiceClass += ' choice-free';
                }
            }
            return `<div class="option-item ${choiceClass}">
                <span class="option-letter">${letter}</span>
                <span class="option-text">${escapeHtml(opt)}</span>
                ${isStudentChoice ? '<span style="margin-left:auto; font-weight:800; font-size:0.85rem;">[SCELTA DELLO STUDENTE]</span>' : ''}
            </div>`;
        }).join('');

        let correctNote = '';
        if (studentAns && (studentAns.outcome === 'wrong' || studentAns.isCorrect === false) && correctIndex !== null && optionsList[correctIndex]) {
            const correctLetter = ['A', 'B', 'C', 'D'][correctIndex] || String(correctIndex + 1);
            correctNote = `<div class="correct-answer-note">&#10003; Risposta esatta attesa: <strong>${correctLetter} - ${escapeHtml(optionsList[correctIndex])}</strong></div>`;
        }

        return `
        <article class="question-entry">
            <div class="question-entry-head">
                <span class="question-num">Domanda #${idx + 1}</span>
                <strong>${title}</strong>
            </div>
            <p class="question-prompt">${prompt}</p>
            <div class="options-list">
                ${optionsHtml}
            </div>
            <div>${evalPill}</div>
            ${correctNote}
        </article>`;
    }).join('');

    const autoPrintScript = options.autoPrint ? `
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() { window.print(); }, 400);
        });
    </script>` : '';

    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scheda Risultati Quiz - ${student} - ${subject}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            background: #f1f5f9;
            color: #0f172a;
            line-height: 1.5;
            padding: 24px 16px;
        }
        .print-toolbar {
            max-width: 860px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .print-toolbar-title {
            font-weight: 700;
            font-size: 1.05rem;
            color: #1e293b;
        }
        .print-toolbar-actions {
            display: flex;
            gap: 10px;
        }
        .btn-print {
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.95rem;
        }
        .btn-print:hover { background: #1d4ed8; }
        .btn-close {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 0.95rem;
        }
        .btn-close:hover { background: #e2e8f0; }

        .report-sheet {
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
        }
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }
        .report-logo-text {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
        }
        .report-subtitle {
            font-size: 0.85rem;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
        }
        .report-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 0.82rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .badge-totale {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
        }
        .badge-parziale {
            background: #fef3c7;
            color: #b45309;
            border: 1px solid #fde68a;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px 24px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 16px 20px;
            margin-bottom: 24px;
        }
        .meta-item { display: flex; flex-direction: column; gap: 2px; }
        .meta-label { font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: #64748b; }
        .meta-value { font-size: 1.05rem; font-weight: 700; color: #0f172a; }

        .score-banner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 22px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .score-pct {
            font-size: 2.2rem;
            font-weight: 800;
            color: #15803d;
            line-height: 1;
        }
        .score-summary {
            text-align: right;
            font-size: 0.95rem;
            color: #1e293b;
        }
        .score-summary strong { color: #0f172a; font-size: 1.05rem; }

        .questions-section-title {
            font-size: 1.15rem;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
        }
        .question-entry {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 18px 20px;
            margin-bottom: 18px;
            background: #ffffff;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .question-entry-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .question-num {
            font-weight: 800;
            font-size: 0.95rem;
            color: #2563eb;
        }
        .question-prompt {
            font-size: 1.05rem;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 14px;
        }
        .options-list {
            display: grid;
            gap: 8px;
            margin-bottom: 12px;
        }
        .option-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 14px;
            border-radius: 8px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            font-size: 0.95rem;
        }
        .option-item.is-student-choice {
            font-weight: 700;
        }
        .option-item.choice-correct {
            background: #dcfce7 !important;
            border-color: #22c55e !important;
            color: #14532d;
        }
        .option-item.choice-wrong {
            background: #fee2e2 !important;
            border-color: #ef4444 !important;
            color: #7f1d1d;
        }
        .option-item.choice-free {
            background: #e0f2fe !important;
            border-color: #38bdf8 !important;
            color: #0369a1;
        }
        .option-letter {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: #e2e8f0;
            font-weight: 800;
            font-size: 0.8rem;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .is-student-choice .option-letter {
            background: #0f172a;
            color: #ffffff;
        }
        .answer-evaluation-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.82rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            margin-top: 6px;
        }
        .pill-correct { background: #dcfce7; color: #166534; }
        .pill-wrong { background: #fee2e2; color: #991b1b; }
        .pill-free { background: #e0f2fe; color: #075985; }
        .pill-unanswered { background: #f1f5f9; color: #64748b; }

        .correct-answer-note {
            margin-top: 8px;
            padding: 6px 12px;
            background: #f8fafc;
            border-left: 3px solid #16a34a;
            font-size: 0.88rem;
            color: #166534;
            font-weight: 600;
        }

        .report-footer {
            margin-top: 36px;
            padding-top: 20px;
            border-top: 1px solid #cbd5e1;
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 20px;
            break-inside: avoid;
            page-break-inside: avoid;
        }
        .notes-area {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            min-height: 80px;
            padding: 10px 14px;
            color: #64748b;
            font-size: 0.88rem;
        }
        .signature-box {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            border-top: 1px solid #0f172a;
            padding-top: 8px;
            margin-top: 40px;
            text-align: center;
            font-size: 0.9rem;
            font-weight: 600;
            color: #0f172a;
        }

        @media print {
            body { background: #ffffff; padding: 0; color: #000; }
            .print-toolbar { display: none !important; }
            .report-sheet {
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
                max-width: 100% !important;
            }
            .question-entry {
                border: 1px solid #94a3b8 !important;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="print-toolbar">
        <span class="print-toolbar-title">Scheda Risultati Quiz Didattico (PDF)</span>
        <div class="print-toolbar-actions">
            <button class="btn-print" onclick="window.print()">&#128438; Stampa / Salva in PDF</button>
            <button class="btn-close" onclick="window.close()">Chiudi</button>
        </div>
    </div>

    <main class="report-sheet">
        <header class="report-header">
            <div>
                <h1 class="report-logo-text">RIC_FACC</h1>
                <p class="report-subtitle">Valutazione Didattica e Autonomia Digitale</p>
            </div>
            <span class="report-badge ${badgeClass}">${badgeText}</span>
        </header>

        <section class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">Studente</span>
                <span class="meta-value">${student}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Materia</span>
                <span class="meta-value">${subject}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Data Inizio</span>
                <span class="meta-value">${dateFormatted}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Data Completamento</span>
                <span class="meta-value">${completionFormatted}</span>
            </div>
        </section>

        <section class="score-banner">
            <div>
                <span style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:#15803d; display:block;">Punteggio Raggiunto</span>
                <span class="score-pct">${pct}%</span>
            </div>
            <div class="score-summary">
                <p>Domande totali: <strong>${totalQuestions}</strong></p>
                <p>Risposte corrette: <strong>${score.esatte || 0}</strong></p>
                <p>Risposte errate: <strong>${score.errate || 0}</strong></p>
            </div>
        </section>

        <section class="questions-section">
            <h2 class="questions-section-title">Dettaglio Domande e Risposte</h2>
            ${questionsHtml}
        </section>

        <footer class="report-footer">
            <div>
                <span class="meta-label" style="display:block; margin-bottom:6px;">Osservazioni del Docente:</span>
                <div class="notes-area">Note o commenti sullo svolgimento della prova...</div>
            </div>
            <div>
                <div class="signature-box">
                    Firma del Docente
                </div>
            </div>
        </footer>
    </main>

    ${autoPrintScript}
</body>
</html>`;
}

function savePartialQuiz(payload) {
    const student = sanitizeName(payload.student || state.activeStudent);
    const studentDir = getStudentDir(student);
    const subject = sanitizeName(payload.subject || payload.materia || state.activeSubject || 'Quiz');
    const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();

    let fileName = payload.fileName;
    if (!fileName || !fileName.endsWith('_parziale.json')) {
        fileName = `${subject}_${formatDateFile(startedAt)}_parziale.json`;
    }
    const filePath = path.join(studentDir, fileName);

    const questions = payload.questions || [];
    const answers = payload.answers || [];
    const totalQuestions = Array.isArray(questions) ? questions.length : Number(payload.totaleDomande || 0);
    const answeredCount = Array.isArray(answers) ? answers.filter(Boolean).length : Number(payload.domandeCompletate || 0);

    const data = {
        id: payload.id || `quiz_${startedAt.getTime()}`,
        studente: payload.student || student,
        cartella: path.relative(ROOT_DIR, studentDir).replace(/\\/g, '/'),
        materia: payload.subject || subject,
        data: formatDateItalian(startedAt),
        dataIso: startedAt.toISOString(),
        dataUltimaModifica: formatDateItalian(new Date()),
        dataUltimaModificaIso: new Date().toISOString(),
        tipoRisultato: 'parziale',
        stato: 'in_corso',
        currentQuestionIndex: Number(payload.currentQuestionIndex || 0),
        totaleDomande: totalQuestions,
        domandeCompletate: answeredCount,
        punteggio: payload.score || { esatte: 0, errate: 0, libere: 0, totaleRisposte: answeredCount, percentuale: 0 },
        domande: questions,
        answers: answers,
        fileName: fileName
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[quiz] salvato risultato parziale in ${fileName} (studente: ${student})`);
    return data;
}

function saveTotalQuiz(payload) {
    const student = sanitizeName(payload.student || state.activeStudent);
    const studentDir = getStudentDir(student);
    const subject = sanitizeName(payload.subject || payload.materia || state.activeSubject || 'Quiz');
    const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();
    const completedAt = new Date();

    const totalFileName = `${subject}_${formatDateFile(startedAt)}_totale.json`;
    const totalFilePath = path.join(studentDir, totalFileName);

    const questions = payload.questions || [];
    const answers = payload.answers || [];
    const totalQuestions = Array.isArray(questions) ? questions.length : Number(payload.totaleDomande || answers.length);
    const answeredCount = Array.isArray(answers) ? answers.filter(Boolean).length : totalQuestions;

    const data = {
        id: payload.id || `quiz_${startedAt.getTime()}`,
        studente: payload.student || student,
        cartella: path.relative(ROOT_DIR, studentDir).replace(/\\/g, '/'),
        materia: payload.subject || subject,
        data: formatDateItalian(startedAt),
        dataIso: startedAt.toISOString(),
        dataCompletamento: formatDateItalian(completedAt),
        dataCompletamentoIso: completedAt.toISOString(),
        tipoRisultato: 'totale',
        stato: 'completato',
        currentQuestionIndex: totalQuestions,
        totaleDomande: totalQuestions,
        domandeCompletate: answeredCount,
        punteggio: payload.score || { esatte: 0, errate: 0, libere: 0, totaleRisposte: answeredCount, percentuale: 0 },
        domande: questions,
        answers: answers,
        fileName: totalFileName,
        schedaReport: `${subject}_${formatDateFile(startedAt)}_scheda.html`
    };

    fs.writeFileSync(totalFilePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[quiz] salvato risultato totale in ${totalFileName} (studente: ${student})`);

    // Write printable HTML file directly into student directory
    try {
        const htmlReport = generatePrintableHtml(data);
        const reportPath = path.join(studentDir, data.schedaReport);
        fs.writeFileSync(reportPath, htmlReport, 'utf-8');
        console.log(`[quiz] salvata scheda stampabile in ${data.schedaReport}`);
    } catch (e) {
        console.error('[quiz] errore generazione scheda HTML:', e.message);
    }

    // Clean up or complete old partial file
    if (payload.fileName && payload.fileName.endsWith('_parziale.json')) {
        const oldPartial = path.join(studentDir, payload.fileName);
        if (fs.existsSync(oldPartial)) {
            try {
                fs.unlinkSync(oldPartial);
                console.log(`[quiz] rimosso file parziale completato: ${payload.fileName}`);
            } catch (e) {
                console.warn('[quiz] avviso eliminazione parziale:', e.message);
            }
        }
    }

    return data;
}

function getActiveSuspendedSession(studentName) {
    const student = sanitizeName(studentName || state.activeStudent);
    const studentDir = getStudentDir(student);

    if (!fs.existsSync(studentDir)) {
        return null;
    }

    const files = fs.readdirSync(studentDir);
    const partialFiles = files.filter((f) => f.endsWith('_parziale.json'));

    const sessions = [];
    for (const file of partialFiles) {
        try {
            const raw = fs.readFileSync(path.join(studentDir, file), 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.stato === 'in_corso' || parsed.stato === 'sospeso') && parsed.tipoRisultato === 'parziale') {
                parsed.fileName = file;
                sessions.push(parsed);
            }
        } catch (e) {
            // Ignore corrupted file
        }
    }

    if (sessions.length === 0) {
        return null;
    }

    sessions.sort((a, b) => {
        const timeA = new Date(a.dataUltimaModificaIso || a.dataIso || 0).getTime();
        const timeB = new Date(b.dataUltimaModificaIso || b.dataIso || 0).getTime();
        return timeB - timeA;
    });

    return sessions[0];
}

function listStudentResults(studentName) {
    const student = sanitizeName(studentName || state.activeStudent);
    const studentDir = getStudentDir(student);

    if (!fs.existsSync(studentDir)) {
        return [];
    }

    const files = fs.readdirSync(studentDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const list = [];
    for (const file of jsonFiles) {
        try {
            const raw = fs.readFileSync(path.join(studentDir, file), 'utf-8');
            const parsed = JSON.parse(raw);
            list.push({
                fileName: file,
                id: parsed.id,
                studente: parsed.studente || student,
                materia: parsed.materia || 'Generale',
                data: parsed.data || '',
                dataIso: parsed.dataIso || '',
                dataCompletamento: parsed.dataCompletamento || '',
                tipoRisultato: parsed.tipoRisultato || (file.includes('_totale') ? 'totale' : 'parziale'),
                stato: parsed.stato || 'completato',
                currentQuestionIndex: parsed.currentQuestionIndex || 0,
                totaleDomande: parsed.totaleDomande || (parsed.domande ? parsed.domande.length : 0),
                domandeCompletate: parsed.domandeCompletate || 0,
                punteggio: parsed.punteggio || { esatte: 0, errate: 0, percentuale: 0 },
                schedaReport: parsed.schedaReport || file.replace(/\.json$/, '_scheda.html')
            });
        } catch (e) {
            // Ignore
        }
    }

    list.sort((a, b) => {
        const timeA = new Date(a.dataIso || 0).getTime();
        const timeB = new Date(b.dataIso || 0).getTime();
        return timeB - timeA;
    });

    return list;
}


function openStudentBrowser() {
    if (state.studentBrowserOpened) {
        return;
    }

    const isStudentAlreadyActive = state.studentUpdatedAt &&
        (Date.now() - new Date(state.studentUpdatedAt).getTime()) < 10000;
    if (isStudentAlreadyActive) {
        state.studentBrowserOpened = true;
        console.log('[server] Pagina studente gia attiva in un browser.');
        return;
    }

    state.studentBrowserOpened = true;
    const studentUrl = `http://localhost:${PORT}/`;
    console.log('');
    console.log('============================================================');
    console.log('[server] QR code acquisito dal docente!');
    console.log(`[server] Avvio automatico pagina studente nel browser: ${studentUrl}`);
    console.log('============================================================');
    console.log('');

    if (process.platform === 'win32') {
        if (process.env.STUDENT_KIOSK === '1') {
            exec(`powershell -NoProfile -WindowStyle Hidden -Command "try { Start-Process 'msedge' -ArgumentList '--kiosk','${studentUrl}','--edge-kiosk-type=fullscreen','--no-first-run','--no-default-browser-check' -ErrorAction Stop } catch { Start-Process '${studentUrl}' }"`);
        } else {
            exec(`start "" "${studentUrl}"`, (error) => {
                if (error) {
                    console.warn('[server] Avviso apertura browser con start:', error.message);
                    exec(`powershell -NoProfile -WindowStyle Hidden -Command "Start-Process '${studentUrl}'"`);
                }
            });
        }
    } else if (process.platform === 'darwin') {
        exec(`open "${studentUrl}"`);
    } else {
        exec(`xdg-open "${studentUrl}"`);
    }
}

function noteTeacherActivity() {
    state.lastTeacherPing = Date.now();
    if (AUTO_OPEN_STUDENT) {
        openStudentBrowser();
    }
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, content, contentType = 'text/plain; charset=utf-8') {
    response.writeHead(statusCode, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
    });
    response.end(content);
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let data = '';

        request.on('data', (chunk) => {
            data += chunk;
            if (data.length > 2 * 1024 * 1024) {
                reject(new Error('Body troppo grande.'));
                request.destroy();
            }
        });

        request.on('end', () => {
            resolve(data);
        });

        request.on('error', reject);
    });
}

function safeResolveFile(urlPath) {
    const relativePath = urlPath === '/' ? '/index.html' : urlPath;
    const normalized = path.normalize(relativePath)
        .replace(/^[/\\]+/, '')
        .replace(/^(\.\.[/\\])+/, '');
    const absolutePath = path.join(ROOT_DIR, normalized);

    if (!absolutePath.startsWith(ROOT_DIR)) {
        return null;
    }

    return absolutePath;
}

function serveStaticFile(urlPath, response) {
    const resolvedPath = safeResolveFile(urlPath);
    if (!resolvedPath) {
        sendText(response, 403, 'Accesso negato.');
        return;
    }

    fs.stat(resolvedPath, (statError, stats) => {
        if (statError || !stats.isFile()) {
            sendText(response, 404, 'File non trovato.');
            return;
        }

        const extension = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';
        const isCodeAsset = extension === '.html' || extension === '.js' || extension === '.css';

        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': isCodeAsset ? 'no-store' : 'public, max-age=60'
        });

        fs.createReadStream(resolvedPath).pipe(response);
    });
}

function pruneCommands() {
    if (state.commands.length > 200) {
        state.commands = state.commands.slice(-200);
    }
}

function handleApiRequest(request, response, url) {
    if (request.method === 'GET' && url.pathname === '/api/network-info') {
        sendJson(response, 200, getNetworkDetails());
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/open-student') {
        openStudentBrowser();
        sendJson(response, 200, { ok: true, opened: state.studentBrowserOpened });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/student-state') {
        noteTeacherActivity();
        sendJson(response, 200, {
            snapshot: state.studentSnapshot,
            updatedAt: state.studentUpdatedAt,
            commandAck: state.lastStudentAck,
            latestAckedCommandId: state.latestAckedCommandId
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/student-state') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                if (!payload.frames && state.studentSnapshot && state.studentSnapshot.frames) {
                    payload.frames = state.studentSnapshot.frames;
                }
                state.studentSnapshot = payload;
                state.studentUpdatedAt = new Date().toISOString();
                state.studentBrowserOpened = true;
                sendJson(response, 200, { ok: true, updatedAt: state.studentUpdatedAt });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Payload studente non valido.' });
            });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/command') {
        noteTeacherActivity();
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                if (!payload.type) {
                    throw new Error('Tipo comando mancante.');
                }

                const command = {
                    id: state.nextCommandId,
                    type: payload.type,
                    payload: payload.payload || {},
                    createdAt: new Date().toISOString()
                };

                state.nextCommandId += 1;
                state.commands.push(command);
                pruneCommands();
                console.log(`[command] ricevuto da docente: id=${command.id} tipo=${command.type}`);
                sendJson(response, 200, { ok: true, command });
            })
            .catch((error) => {
                console.log(`[command] errore: ${error.message}`);
                sendJson(response, 400, { error: error.message || 'Comando non valido.' });
            });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/commands') {
        const after = Number(url.searchParams.get('after') || 0);
        const latestCommandId = state.commands.length > 0
            ? state.commands[state.commands.length - 1].id
            : 0;
        // If the client's cursor is beyond what we know (e.g. server was restarted while
        // the student tab kept its old counter), reset it to 0 so new commands surface.
        const sanitizedAfter = after > latestCommandId ? 0 : after;
        const effectiveAfter = Math.max(sanitizedAfter, state.latestAckedCommandId);
        const commands = state.commands.filter((command) => command.id > effectiveAfter);

        if (commands.length > 0) {
            const ids = commands.map((command) => `${command.id}:${command.type}`).join(', ');
            console.log(`[command] consegna allo studente (after=${after}): ${ids}`);
        }

        sendJson(response, 200, {
            commands,
            latestCommandId,
            ackedCommandId: state.latestAckedCommandId
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/command-ack') {
        readRequestBody(request)
            .then((body) => {
                const payload = body ? JSON.parse(body) : {};
                const commandId = Number(payload.id);
                if (!Number.isFinite(commandId) || commandId <= 0) {
                    throw new Error('ID comando non valido.');
                }

                state.latestAckedCommandId = Math.max(state.latestAckedCommandId, commandId);
                state.lastStudentAck = {
                    id: commandId,
                    type: String(payload.type || ''),
                    status: payload.status === 'error' ? 'error' : 'ok',
                    message: String(payload.message || ''),
                    ackedAt: new Date().toISOString()
                };

                console.log(`[command] ack dallo studente: id=${commandId} tipo=${state.lastStudentAck.type} stato=${state.lastStudentAck.status}`);
                sendJson(response, 200, {
                    ok: true,
                    ackedCommandId: state.latestAckedCommandId,
                    commandAck: state.lastStudentAck
                });
            })
            .catch((error) => {
                sendJson(response, 400, { error: error.message || 'Ack comando non valido.' });
            });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/students') {
        if (!fs.existsSync(STUDENTS_BASE_DIR)) {
            fs.mkdirSync(STUDENTS_BASE_DIR, { recursive: true });
        }
        const entries = fs.readdirSync(STUDENTS_BASE_DIR, { withFileTypes: true });
        const students = entries.filter((e) => e.isDirectory()).map((e) => e.name.replace(/_/g, ' '));
        if (!students.includes(state.activeStudent)) {
            students.unshift(state.activeStudent);
        }
        sendJson(response, 200, {
            students: [...new Set(students)],
            activeStudent: state.activeStudent,
            activeStudentDir: path.relative(ROOT_DIR, getStudentDir(state.activeStudent)).replace(/\\/g, '/')
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/students/active') {
        readRequestBody(request).then((body) => {
            const payload = body ? JSON.parse(body) : {};
            const studentName = payload.activeStudent || payload.name;
            if (studentName) {
                state.activeStudent = String(studentName).trim();
                getStudentDir(state.activeStudent);
            }
            const subjectName = payload.activeSubject || payload.subject;
            if (subjectName) {
                state.activeSubject = String(subjectName).trim();
            }
            sendJson(response, 200, {
                ok: true,
                activeStudent: state.activeStudent,
                activeStudentDir: path.relative(ROOT_DIR, getStudentDir(state.activeStudent)).replace(/\\/g, '/'),
                activeSubject: state.activeSubject
            });
        }).catch((err) => {
            sendJson(response, 400, { error: err.message });
        });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/student/info') {
        sendJson(response, 200, {
            activeStudent: state.activeStudent,
            activeStudentDir: path.relative(ROOT_DIR, getStudentDir(state.activeStudent)).replace(/\\/g, '/'),
            activeSubject: state.activeSubject
        });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/quiz/active-session') {
        const student = url.searchParams.get('student') || state.activeStudent;
        const session = getActiveSuspendedSession(student);
        sendJson(response, 200, {
            hasActiveSession: !!session,
            session: session || null,
            student
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/quiz/save-partial') {
        readRequestBody(request).then((body) => {
            const payload = body ? JSON.parse(body) : {};
            const result = savePartialQuiz(payload);
            sendJson(response, 200, { ok: true, session: result });
        }).catch((err) => {
            console.error('[quiz] errore salvataggio parziale:', err.message);
            sendJson(response, 400, { error: err.message });
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/quiz/save-total') {
        readRequestBody(request).then((body) => {
            const payload = body ? JSON.parse(body) : {};
            const result = saveTotalQuiz(payload);
            sendJson(response, 200, { ok: true, session: result });
        }).catch((err) => {
            console.error('[quiz] errore salvataggio totale:', err.message);
            sendJson(response, 400, { error: err.message });
        });
        return true;
    }

    if (request.method === 'POST' && url.pathname === '/api/quiz/session-action') {
        readRequestBody(request).then((body) => {
            const payload = body ? JSON.parse(body) : {};
            const action = payload.action;
            const student = payload.student || state.activeStudent;
            const session = getActiveSuspendedSession(student);

            if (action === 'resume') {
                if (!session) {
                    throw new Error('Nessuna sessione sospesa trovata da riprendere.');
                }
                const command = {
                    id: state.nextCommandId++,
                    type: 'resume-session',
                    payload: { session },
                    createdAt: new Date().toISOString()
                };
                state.commands.push(command);
                pruneCommands();
                sendJson(response, 200, { ok: true, action: 'resume', session });
                return;
            }

            if (action === 'restart') {
                if (!session) {
                    throw new Error('Nessuna sessione trovata da riavviare.');
                }
                session.currentQuestionIndex = 0;
                session.answers = [];
                session.punteggio = { esatte: 0, errate: 0, libere: 0, totaleRisposte: 0, percentuale: 0 };
                session.startedAt = new Date().toISOString();
                session.data = formatDateItalian(new Date());
                session.fileName = null;
                const refreshed = savePartialQuiz(session);

                const command = {
                    id: state.nextCommandId++,
                    type: 'restart-session',
                    payload: { session: refreshed },
                    createdAt: new Date().toISOString()
                };
                state.commands.push(command);
                pruneCommands();
                sendJson(response, 200, { ok: true, action: 'restart', session: refreshed });
                return;
            }

            if (action === 'new') {
                if (session && session.fileName) {
                    const studentDir = getStudentDir(student);
                    const oldPath = path.join(studentDir, session.fileName);
                    if (fs.existsSync(oldPath)) {
                        session.stato = 'archiviato';
                        session.tipoRisultato = 'parziale';
                        fs.writeFileSync(oldPath, JSON.stringify(session, null, 2), 'utf-8');
                    }
                }
                const command = {
                    id: state.nextCommandId++,
                    type: 'new-session',
                    payload: {},
                    createdAt: new Date().toISOString()
                };
                state.commands.push(command);
                pruneCommands();
                sendJson(response, 200, { ok: true, action: 'new' });
                return;
            }

            throw new Error('Azione non valida. Valori ammessi: resume, restart, new.');
        }).catch((err) => {
            console.error('[quiz] errore session-action:', err.message);
            sendJson(response, 400, { error: err.message });
        });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/quiz/results') {
        const student = url.searchParams.get('student') || state.activeStudent;
        const results = listStudentResults(student);
        sendJson(response, 200, {
            student,
            results,
            files: results,
            folder: path.relative(ROOT_DIR, getStudentDir(student)).replace(/\\/g, '/')
        });
        return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/quiz/result-detail') {
        const student = url.searchParams.get('student') || state.activeStudent;
        const file = url.searchParams.get('file');
        if (!file) {
            sendJson(response, 400, { error: 'Parametro file mancante.' });
            return true;
        }
        const studentDir = getStudentDir(student);
        const safeFile = path.basename(file);
        const filePath = path.join(studentDir, safeFile);
        if (!fs.existsSync(filePath)) {
            sendJson(response, 404, { error: 'File non trovato.' });
            return true;
        }
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            sendJson(response, 200, JSON.parse(raw));
        } catch (err) {
            sendJson(response, 500, { error: err.message });
        }
        return true;
    }

    return false;
}

function isPrivateIpv4(address) {
    if (address.startsWith('10.')) {
        return true;
    }

    if (address.startsWith('192.168.')) {
        return true;
    }

    const parts = address.split('.');
    if (parts.length !== 4) {
        return false;
    }

    const first = Number(parts[0]);
    const second = Number(parts[1]);
    return first === 172 && second >= 16 && second <= 31;
}

function interfaceLooksVirtual(name) {
    return /bluetooth|docker|hyper-v|loopback|nord|openvpn|tailscale|tun|virtual|vmware|vbox|vethernet|vpn|wsl/i.test(name);
}

function buildPageUrls(host) {
    return [
        `http://${host}:${PORT}/`,
        `http://${host}:${PORT}/teacher`
    ];
}

function getNetworkDetails() {
    const interfaces = os.networkInterfaces();
    const lan = [];
    const others = [];

    Object.entries(interfaces).forEach(([name, addresses]) => {
        (addresses || []).forEach((address) => {
            if (address.family !== 'IPv4' || address.internal) {
                return;
            }

            const isWifi = /wi-?fi|wlan|wireless/i.test(name);
            const isLikelyLan = isPrivateIpv4(address.address) && !interfaceLooksVirtual(name);
            const entry = {
                name,
                address: address.address,
                isWifi,
                teacherUrl: `http://${address.address}:${PORT}/teacher`,
                studentUrl: `http://${address.address}:${PORT}/`
            };

            if (isLikelyLan) {
                lan.push(entry);
            } else {
                others.push(entry);
            }
        });
    });

    lan.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));

    const defaultIp = lan.length > 0 ? lan[0].address : 'localhost';
    const teacherActive = (Date.now() - (state.lastTeacherPing || 0)) < 7000;

    return {
        port: PORT,
        defaultIp,
        teacherUrl: `http://${defaultIp}:${PORT}/teacher`,
        studentUrl: `http://${defaultIp}:${PORT}/`,
        lan,
        others,
        teacherConnected: teacherActive,
        studentOpened: state.studentBrowserOpened
    };
}

function printAvailableUrls() {
    const netInfo = getNetworkDetails();

    console.log('');
    console.log(`Server Ric_Facc attivo sulla porta ${PORT}.`);
    console.log('Quiz studente su questo PC:');
    console.log(`- ${netInfo.studentUrl}`);
    console.log(`- http://localhost:${PORT}/`);
    console.log('');

    if (AUTO_OPEN_STUDENT) {
        console.log('Apertura automatica studente: ATTIVA');
        console.log('(appena il docente inquadra il QR code, la pagina studente si aprira nel browser di questo PC)');
        console.log('');
    }

    if (netInfo.lan.length > 0) {
        console.log('URL per smartphone o tablet docente (stessa rete Wi-Fi):');
        netInfo.lan.forEach((entry) => {
            const tag = entry.isWifi ? ' [CONSIGLIATO - Wi-Fi]' : ` [${entry.name}]`;
            console.log(`- Docente:  ${entry.teacherUrl}${tag}`);
            console.log(`  Studente: ${entry.studentUrl}`);
        });
        console.log('');
    }

    if (netInfo.others.length > 0) {
        console.log('Altri indirizzi rilevati (VPN o virtuali):');
        netInfo.others.forEach((entry) => console.log(`- ${entry.address} [${entry.name}]`));
        console.log('');
    }

    try {
        const qrcode = require('./qrcode.min.js');
        const qr = qrcode(0, 'L');
        qr.addData(netInfo.teacherUrl);
        qr.make();
        console.log('============================================================');
        console.log('  QR CODE COLLEGAMENTO DOCENTE (scansiona con smartphone/tablet)');
        console.log('  ' + netInfo.teacherUrl);
        console.log('============================================================');
        console.log(qr.createASCII(1, 1));
        console.log('============================================================');
    } catch (e) {
        // Se la stampa ascii fallisce, si prosegue regolarmente
    }

    console.log('');
    console.log(`Riquadro grafico QR disponibile su: http://localhost:${PORT}/connetti.html`);
    console.log('');
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        response.end();
        return;
    }

    if (handleApiRequest(request, response, url)) {
        return;
    }

    if (url.pathname === '/connetti' || url.pathname === '/qr') {
        serveStaticFile('/connetti.html', response);
        return;
    }

    if (url.pathname === '/teacher' || url.pathname === '/docente' || url.pathname === '/teacher.html') {
        noteTeacherActivity();
        serveStaticFile('/teacher.html', response);
        return;
    }

    if (url.pathname === '/debug') {
        serveStaticFile('/debug.html', response);
        return;
    }

    if (url.pathname === '/stampa-risultato' || url.pathname === '/api/quiz/print') {
        const student = url.searchParams.get('student') || state.activeStudent;
        const file = url.searchParams.get('file');
        const autoPrint = url.searchParams.get('autoPrint') === '1' || url.searchParams.get('print') === '1';

        if (!file) {
            sendText(response, 400, 'Parametro file mancante.');
            return;
        }

        const studentDir = getStudentDir(student);
        const safeFile = path.basename(file);
        const jsonPath = path.join(studentDir, safeFile);

        if (!fs.existsSync(jsonPath)) {
            sendText(response, 404, 'File di risultato non trovato nella cartella dello studente.');
            return;
        }

        try {
            const raw = fs.readFileSync(jsonPath, 'utf-8');
            const quizData = JSON.parse(raw);
            const html = generatePrintableHtml(quizData, { autoPrint });
            sendText(response, 200, html, 'text/html; charset=utf-8');
        } catch (err) {
            sendText(response, 500, `Errore caricamento scheda: ${err.message}`);
        }
        return;
    }

    serveStaticFile(url.pathname, response);
});

server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
        console.error('');
        console.error(`La porta ${PORT} e gia in uso.`);
        console.error('Il server potrebbe essere gia attivo in un altra finestra.');
        console.error('Chiudi l altro processo oppure avvia con una porta diversa, ad esempio:');
        console.error(`set PORT=${PORT + 1} && node server.js`);
        console.error('');
        process.exit(1);
        return;
    }

    console.error(error);
    process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
    printAvailableUrls();
});
