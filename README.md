# Ric_Facc — Quiz accessibile a controllo facciale

**Ric_Facc** è una web app didattica accessibile che permette a uno studente con disabilità
motoria di **rispondere a un quiz in stile Kahoot usando solo i movimenti del viso**, senza
mouse, tastiera o touch. Il riconoscimento avviene in tempo reale nel browser tramite
**face-tracking MediaPipe**: aprire la bocca scorre le risposte, chiudere gli occhi le seleziona.

Il progetto comprende inoltre un **pannello docente** controllabile da tablet sulla stessa rete
locale e un **comunicatore alfabetico** autonomo (tastiera AAC a scansione) che usa la stessa
modalità di selezione per scrivere e farsi leggere frasi a voce.

> Nato come strumento per un esame scolastico reale, è pensato per la **frustrazione zero**:
> nessuna scansione automatica forzata, ritmo deciso dall'utente, conferme di sicurezza,
> feedback sonoro e vocale costanti.

---

## Indice

- [Caratteristiche principali](#caratteristiche-principali)
- [Come funziona il controllo facciale](#come-funziona-il-controllo-facciale)
- [Architettura](#architettura)
- [Requisiti](#requisiti)
- [Installazione su Windows](#installazione-su-windows)
- [Avvio e utilizzo](#avvio-e-utilizzo)
- [Il comunicatore alfabetico](#il-comunicatore-alfabetico)
- [Banca domande](#banca-domande)
- [Struttura del progetto](#struttura-del-progetto)
- [Stack tecnologico](#stack-tecnologico)
- [Privacy](#privacy)
- [Licenza e crediti](#licenza-e-crediti)

---

## Caratteristiche principali

- 🎯 **Controllo a due soli movimenti** — bocca (scorri/conferma) e occhi (seleziona/annulla).
- 🧠 **Macchina a stati "Navigazione manuale" (Metodo B)** — l'utente decide quando muoversi e
  quando confermare, al suo passo; nessuna scansione automatica a tempo.
- 🛡️ **Conferma di sicurezza (safe check)** prima di registrare ogni risposta.
- 🔊 **Feedback multisensoriale** — chime sonori a ogni azione e **sintesi vocale italiana**
  (preferenza per voce femminile neurale) che legge domande, opzioni e messaggi.
- 👓 **Modalità occhiali** — smoothing e soglie ottimizzate per l'uso con occhiali.
- 🖥️ **Avvio in modalità kiosk** a schermo intero per evitare distrazioni.
- 📡 **Pannello docente in rete locale** — un tablet/telefono pilota il PC dello studente
  (avvio esame, lettura, scorrimento, pubblicazione domande, diapositive, ecc.).
- 🖼️ **Diapositive di presentazione** sincronizzabili sullo schermo dello studente.
- ♿ **Comunicatore alfabetico autonomo** — scrittura per lettere a scansione + lettura vocale.
- 📚 **Banca domande per materia** in semplici file JSON, con import da XLSX/CSV/DOCX/TXT.
- 🪶 **Zero dipendenze npm** lato server: solo Node.js standard.

---

## Come funziona il controllo facciale

Il tracciamento usa **MediaPipe FaceMesh** e calcola due metriche dai landmark del volto:

- **EAR** (*Eye Aspect Ratio*) — quanto sono aperti gli occhi. Sotto la soglia `0.13` → occhi chiusi.
- **MAR** (*Mouth Aspect Ratio*) — quanto è aperta la bocca. Sopra la soglia `0.17` → bocca aperta.

Da questi due segnali nascono due comandi:

| Comando | Gesto | Funzione |
|---|---|---|
| **SCROLL** | Apri la bocca (MAR > soglia) | Sposta l'evidenziatore alla risposta successiva (in ciclo) e, nella conferma, vale "Sì". |
| **SELECT** | Chiudi gli occhi ~1 s (EAR < soglia) | Seleziona la risposta evidenziata; nella conferma vale "Annulla". |

Lo scorrimento ha un'attivazione rapida (~0,3 s) e un *cooldown* (~1 s) per filtrare i movimenti
involontari; la selezione richiede di **tenere gli occhi chiusi** per circa un secondo (con barra
di caricamento) così da avere la certezza dell'intenzionalità.

### Macchina a stati del quiz

```
LETTURA  ──(bocca)──►  NAVIGAZIONE  ──(occhi)──►  PRE-SELEZIONE  ──(barra piena)──►  SAFE CHECK
  ▲                         ▲ │                          │                              │
  │                         │ └──(bocca: cambia opzione)─┘                              │
  │                         └──────────(occhi: annulla)──────────────────────────┐     │
  └────────────────  RISPOSTA REGISTRATA  ◄──(bocca: conferma)────────────────────┴─────┘
```

- **Lettura (idle):** tutto statico, l'utente legge con calma.
- **Navigazione (focus):** un'opzione è evidenziata; la bocca cambia opzione, gli occhi avviano la scelta.
- **Pre-selezione:** barra che si riempie tenendo gli occhi chiusi; riaprendoli si annulla.
- **Safe check:** "Hai scelto X. Confermi?" — bocca = conferma, occhi tenuti chiusi = annulla.

I parametri (soglie e tempi) sono raccolti in `CONFIG`, in cima a [`app.js`](app.js). La logica di
progettazione è documentata in [`Sistema Scelta.md`](Sistema%20Scelta.md).

---

## Architettura

Tre attori comunicano tramite un piccolo server *relay* in rete locale:

```
   ┌─────────────────────┐        HTTP /api        ┌──────────────────────┐
   │  STUDENTE (PC)       │  ◄───────────────────►  │  DOCENTE (tablet)    │
   │  index.html + app.js │      server.js          │  teacher.html + .js  │
   │  webcam + FaceMesh   │   (Node.js, porta 3000) │  pannello di regia   │
   └─────────────────────┘                          └──────────────────────┘
            │
            └──►  COMUNICATORE (pagina autonoma)  comunicatore.html + .css + .js
```

- **Studente** — [`index.html`](index.html) / [`app.js`](app.js): webcam, face-tracking, quiz,
  sintesi vocale, overlay diapositive e ringraziamenti finali.
- **Docente** — [`teacher.html`](teacher.html) / [`teacher.js`](teacher.js): controlla a distanza
  il PC dello studente (inizio esame, lettura domanda, scroll/seleziona/conferma, domanda
  successiva/ripeti, reset, pubblicazione domande, diapositive, fine esame).
- **Server** — [`server.js`](server.js): server HTTP senza dipendenze. Serve i file statici e fa
  da *relay* di comandi e stato tra docente e studente (endpoint `/api/state`, `/api/command`,
  `/api/commands`, `/api/command-ack`). I comandi sono recapitati allo studente in *polling*.
- **Comunicatore** — [`comunicatore.html`](comunicatore.html): pagina **separata e indipendente**
  dal flusso d'esame, con pipeline FaceMesh propria.

I comandi remoti viaggiano sulla stessa rete Wi-Fi/LAN; **nessun dato esce dal PC** (vedi [Privacy](#privacy)).

---

## Requisiti

- **Node.js 18+** (il backend non richiede pacchetti npm).
- Un **browser moderno** con accesso alla **webcam** (consigliato Microsoft Edge o Google Chrome).
- Connessione a internet **al primo avvio**: alcune librerie frontend (MediaPipe, XLSX, Mammoth)
  sono caricate da CDN.
- Per il pannello docente: tablet/telefono sulla **stessa rete Wi-Fi/LAN** del PC.

---

## Installazione su Windows

Il progetto è pensato per funzionare su Windows anche partendo da zero.

### Installazione automatica (consigliata)

1. Copia l'intera cartella del progetto sul PC.
2. Esegui **`installa-ric-facc.cmd`** e conferma la richiesta di amministratore.
   Lo script: verifica/installa Node.js LTS (via `winget` o MSI ufficiale), apre la porta `3000`
   nel firewall per le reti private, crea un collegamento `Ric_Facc` sul Desktop e avvia il server.

Dettagli completi in [`INSTALLAZIONE_WINDOWS.md`](INSTALLAZIONE_WINDOWS.md).

### Avvio quotidiano

- **`avvia-ric-facc.cmd`** (o il collegamento `Ric_Facc` sul Desktop): avvia il server e apre la
  pagina studente **a schermo intero in modalità kiosk** (Edge). Per chiudere: `Alt+F4`.
- **`avvia-server-rete.cmd`**: avvia il server in rete locale e apre automaticamente un **riquadro grafico dedicato con il QR Code** per far inquadrare e collegare il docente con cellulare o tablet. **Appena il docente inquadra il QR Code, la pagina studente (`http://localhost:3000/`) si apre automaticamente nel browser del PC**.
- **`apri-qr.cmd`**: apre in qualsiasi momento la finestra grafica con il QR code docente.

### Avvio manuale (qualsiasi sistema)

```bash
node server.js          # oppure: npm start
# porta personalizzata:
PORT=8080 node server.js
```

All'avvio, la console stampa gli URL utili (locali e LAN).

---

## Avvio e utilizzo

Con il server attivo:

| Pagina | URL | A cosa serve |
|---|---|---|
| **Studente** | `http://localhost:3000/` | Quiz a controllo facciale sul PC. |
| **Docente** | `http://<IP-del-PC>:3000/teacher.html` | Regia da tablet sulla stessa rete. |
| **Comunicatore** | `http://localhost:3000/comunicatore.html` | Tastiera alfabetica a scansione (vedi sotto). |
| Debug studente | `http://localhost:3000/debug.html` | Strumenti di diagnosi del tracking. |
| Manuale | `http://localhost:3000/manuale.html` | Guida d'uso illustrata. |

**Flusso d'esame (modalità solo domande):** lo studente accede direttamente al quiz (subito pronto con le domande attive, senza schermate d'attesa o diapositive) → il docente gestisce le domande dal pannello `teacher.html` (selezione materia dalla banca domande, lettura domanda, comandi remoti e inserimento nuove domande live) → lo studente risponde tramite riconoscimento facciale (bocca/occhi) o comandi remoti del docente.

---

## Il comunicatore alfabetico

[`comunicatore.html`](comunicatore.html) è una **sessione a parte**, indipendente dal quiz: una
**tastiera AAC a scansione** che usa la **stessa identica modalità di selezione** dell'esame.

- **Bocca aperta** → scorre i riquadri; **occhi chiusi ~1 s** → sceglie.
- Struttura a due livelli: **gruppi** (VOCALI · CONSONANTI 1/2/3 · NUMERI · AZIONI) → **lettere**.
- La frase si compone nel tabellone in alto e viene **letta a voce** (lettere, parole e frase intera).
- Azioni disponibili: `SPAZIO`, `CANCELLA`, `LEGGI`, `SÌ`, `NO`, `PULISCI`.
- Una schermata di avvio dedicata chiede la webcam e attiva lo schermo intero; `Esc` o **CHIUDI**
  mette in pausa, **AUDIO ON/OFF** gestisce la voce. Un HUD mostra l'auto-inquadratura e i valori EAR/MAR.

> Per la webcam serve un contesto sicuro: aprire la pagina via `http://localhost:3000/comunicatore.html`.

---

## Banca domande

Le domande vivono in [`domande/`](domande/), **un file JSON per materia**: Italiano, Storia,
Geografia, Scienze, Matematica, Tecnologia, Inglese, Francese, Arte, Musica, Educazione Civica,
Educazione Fisica, Religione. All'avvio lo studente carica la materia predefinita (Italiano).

Formato di ogni domanda:

```json
[
  {
    "title": "Manzoni e la lingua de I Promessi Sposi",
    "prompt": "Perché Manzoni scelse una lingua semplice e quale modello usò?",
    "options": [
      "Voleva usare il latino per rivolgersi solo ai nobili e ai dotti.",
      "Voleva il fiorentino parlato dai colti per unificare l'Italia.",
      "Voleva scrivere in dialetto milanese perché era più spontaneo.",
      "Voleva creare una lingua complicata per dimostrare la sua bravura."
    ],
    "correctIndex": 1
  }
]
```

- `options` accetta **da 2 a 4 risposte**.
- `correctIndex` è l'indice (0-based) della risposta corretta. Per domande **a scelta libera**
  (senza risposta giusta) la scelta dello studente viene sempre accettata come valida.
- Dal pannello docente è possibile **scrivere una domanda al volo** oppure **importare** un file
  `XLSX`, `CSV`, `DOCX`, `TXT` o `JSON` e pubblicarlo subito o metterlo in coda.

---

## Struttura del progetto

```
Ric_Facc/
├── index.html / app.js / style.css      # App studente (quiz a controllo facciale)
├── teacher.html / teacher.js / teacher.css  # Pannello docente in rete locale
├── server.js                            # Server Node.js + relay comandi (no dipendenze)
├── comunicatore.html / .css / .js       # Comunicatore alfabetico autonomo (AAC)
├── debug.html / debug.js                # Diagnostica tracking studente
├── teacher-debug.html / teacher-debug.js
├── manuale.html / manuale.css / manuale.js  # Manuale d'uso illustrato
├── domande/                             # Banca domande JSON, una per materia
├── presentazione/                       # Diapositive d'esame (PNG + PDF)
├── installa-ric-facc.cmd / .ps1         # Installazione automatica Windows
├── avvia-ric-facc.cmd                   # Avvio kiosk a schermo intero
├── avvia-server-rete.cmd                # Avvio solo server + indirizzi LAN
├── INSTALLAZIONE_WINDOWS.md             # Guida installazione
├── Sistema Scelta.md                    # Progettazione della macchina a stati
└── package.json
```

---

## Stack tecnologico

- **Backend:** Node.js (moduli `http`, `fs`, `os`, `path`) — nessuna dipendenza npm.
- **Face-tracking:** [MediaPipe FaceMesh](https://developers.google.com/mediapipe) (via CDN).
- **Voce:** Web Speech API (`SpeechSynthesis`), lingua `it-IT`.
- **Audio feedback:** Web Audio API.
- **Import domande:** [SheetJS/xlsx](https://sheetjs.com) e [Mammoth.js](https://github.com/mwilliamson/mammoth.js) (via CDN).
- **Frontend:** HTML/CSS/JavaScript vanilla; font *Space Grotesk*, *Atkinson Hyperlegible* (alta leggibilità) e *Oswald*.

---

## Privacy

- Il **flusso video della webcam è elaborato solo localmente** nel browser dello studente: non
  viene registrato né inviato in rete.
- Il server scambia **solo** comandi di regia e metadati di stato (es. valori EAR/MAR, domanda
  corrente) tra docente e studente sulla **rete locale**.
- Le librerie frontend sono scaricate da CDN al primo utilizzo.

---

## Licenza e crediti

⚠️ **Software proprietario a uso riservato.** La proprietà intellettuale è del logopedista
**Dott. Carlo Santoro**. L'uso è concesso in licenza limitata e soggetto a restrizioni (gli avvii
includono un controllo di validità temporale). Non è consentita la redistribuzione senza autorizzazione.

Per informazioni e autorizzazioni:

- 📧 vespaxp74@gmail.com
- 📞 338 2948987

Realizzato come strumento per un esame scolastico reale. Un ringraziamento speciale a **Giuseppe**
per l'impegno dimostrato.
