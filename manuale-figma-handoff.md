# Manuale Ric_Facc - handoff Figma

Questo file descrive come ricreare il manuale in Figma con una struttura pensata prima per smartphone in vista verticale.

## Obiettivo

Realizzare un manuale sintetico ma chiaro, adatto a:

- docenti
- famiglia
- ambiente scolastico

## Formato consigliato

- Frame principale: `390 x 844` px
- Modalita: mobile portrait
- Griglia: 4 colonne
- Margini laterali: `16 px`
- Spazio tra colonne: `12 px`
- Spaziatura verticale base: `14 px`

## Struttura della pagina

1. Hero iniziale
2. Barra sticky con filtri e tasti sezione
3. Sezione panoramica
4. Sezione avvio rapido
5. Sezione esperienza studente
6. Sezione uso docente
7. Sezione uso famiglia
8. Sezione rete e materiali

## Componenti da creare

### 1. Hero card

- Sfondo: gradiente blu istituzionale
- Titolo grande
- Testo introduttivo breve
- Tre card statistiche:
  - `Volto + webcam`
  - `Tablet in rete locale`
  - `XLSX, CSV, DOCX, JSON, TXT`

### 2. Chip filtro

Tre varianti:

- `Vista completa`
- `Solo docenti`
- `Solo famiglia`

Stato attivo:

- sfondo blu
- testo bianco
- bordo blu

Stato inattivo:

- sfondo bianco
- testo blu scuro
- bordo grigio chiaro

### 3. Pulsanti di navigazione sezione

Etichette:

- `Panoramica`
- `Avvio`
- `Studente`
- `Docente`
- `Famiglia`
- `Rete e file`

Tutti i pulsanti devono essere grandi abbastanza da essere usati comodamente su telefono.

### 4. Card contenuto

Varianti:

- standard bianca
- primaria azzurra
- secondaria verde chiaro
- soft ambra

### 5. Step verticali

Ogni step contiene:

- numero in badge quadrato arrotondato
- titolo breve
- testo di una o due righe

## Palette colori

- Sfondo pagina: `#EEF3F9`
- Superficie card: `#FFFFFF`
- Blu primario: `#1F5FBF`
- Blu scuro: `#143C7E`
- Testo principale: `#102038`
- Testo secondario: `#58677D`
- Bordi: `#D4DDEA`
- Verde supporto: `#0F766E`
- Verde conferma: `#2F855A`
- Ambra attenzione: `#C2871F`

## Tipografia

- Titoli: `Newsreader`
- Testi e pulsanti: `Manrope`

Gerarchia consigliata:

- Hero title: 40-48 px
- Titoli sezione: 30-36 px
- Titoli card: 18-20 px
- Testo base: 16 px
- Etichette chip: 14-15 px

## Contenuti chiave da mantenere

### Panoramica

- quiz accessibile con occhi e bocca
- monitoraggio docente da tablet
- supporto della famiglia a casa

### Avvio rapido

- avviare `server.js`
- aprire `index.html`
- aprire `teacher.html`
- caricare o usare il test base

### Esperienza studente

- Lettura
- Navigazione
- Pre-selezione
- Safe check

### Uso docente

- monitoraggio live
- comandi remoti
- pubblicazione di nuove domande

### Uso famiglia

- preparazione ambiente
- supporto tranquillo
- controllo comfort dello studente

### Rete e materiali

- formati supportati
- stessa rete locale
- checklist finale

## Stile visivo

- professionale
- sobrio
- leggibile
- adatto alla scuola
- senza colori aggressivi o troppo ludici

## Prototipazione Figma

Per simulare l'esplorazione:

- collega i chip filtro a versioni dedicate della stessa pagina
- collega i pulsanti sezione agli anchor frame delle diverse sezioni
- aggiungi una variante con stato attivo per il pulsante corrente

## Riferimenti nel progetto

- Pagina manuale realizzata: `manuale.html`
- Stili: `manuale.css`
- Interazioni: `manuale.js`
