# Creare le domande del quiz con l'intelligenza artificiale
> **Mimika — Un programma ideato e gestito dal dott. Carlo Santoro**

**Guida per i docenti — Mimika**

Con questo modello trasformi un testo (un capitolo, una scheda, un riassunto) in un file Excel di domande già pronto da caricare in Mimika. Funziona con Gemini e con qualsiasi altro assistente AI. Scegli tu il numero di domande, la difficoltà e quante risposte avrà ciascuna domanda (2, 3, 4 o miste).

## In breve

1. **Copia il prompt** del punto 1 in Gemini, sostituisci le parti tra `[parentesi quadre]` e incolla il tuo testo.
2. **Copia la tabella** che Gemini restituisce, incollala in Excel (cella A1) e salva come `.xlsx`.
3. **Carica il file** in Mimika e controlla l'anteprima prima di pubblicare.

---

## 1. Il prompt da copiare

Sostituisci le parti tra `[parentesi quadre]`:

| Segnaposto | Cosa scrivere | Esempio |
|---|---|---|
| `[MATERIA]` | La disciplina | Scienze |
| `[DIFFICOLTÀ]` | Quanto devono essere impegnative le domande | `facile`, `media` o `difficile` |
| `[NUMERO]` | Quante domande vuoi (qualsiasi numero) | 10 |
| `[NUMERO RISPOSTE]` | Quante risposte per ogni domanda | `2`, `3`, `4` oppure `MISTO` |
| `[INCOLLA QUI IL TESTO]` | Il testo da cui partire | il tuo capitolo |

**Quante risposte?**

| Scelta | Risultato |
|---|---|
| `4` | Tutte le domande hanno 4 risposte (A, B, C, D). |
| `3` | Tutte le domande hanno 3 risposte (A, B, C). |
| `2` | Tutte le domande hanno 2 risposte, in genere Vero/Falso (A = Vero, B = Falso). |
| `MISTO` | L'AI alterna domande con 2, 3 e 4 risposte, scegliendo caso per caso. Puoi anche precisare la miscela, per esempio `MISTO: metà con 4 risposte e metà Vero/Falso`. |

Mimika accetta senza problemi domande con un numero diverso di risposte nello stesso file. Meno risposte significano meno scorrimenti con la bocca per lo studente, ma più probabilità di indovinare (50% con 2 risposte).

```
Sei un insegnante esperto di [MATERIA]. Leggi il testo che trovi in fondo e scrivi [NUMERO] domande a risposta multipla, di difficoltà [DIFFICOLTÀ], per verificare che lo studente lo abbia capito.

Le domande saranno lette ad alta voce da una sintesi vocale e lo studente ascolterà le risposte una alla volta: usa quindi frasi semplici e brevi.

REGOLE SULLE DOMANDE
- Basa ogni domanda solo sul testo fornito, senza aggiungere nozioni esterne.
- Difficoltà: se è "facile", chiedi informazioni scritte in modo esplicito nel testo; se è "media", chiedi di collegare due informazioni del testo; se è "difficile", chiedi un ragionamento o di distinguere tra risposte molto simili.
- Numero di risposte per domanda: [NUMERO RISPOSTE]. Se è 2, 3 o 4, usa quel numero per tutte le domande (con 2 risposte preferisci il formato Vero/Falso: A = Vero, B = Falso). Se è MISTO, alterna domande con 2, 3 e 4 risposte secondo ciò che è più adatto a ciascuna domanda, rispettando eventuali indicazioni date.
- Ogni domanda ha UNA SOLA risposta corretta. Le altre devono essere plausibili ma chiaramente sbagliate in base al testo.
- Domande: massimo 25 parole. Risposte: massimo 10 parole, di lunghezza simile tra loro.
- Distribuisci la risposta corretta in modo vario tra le posizioni disponibili: non metterla sempre nella stessa posizione e non farla sempre la più lunga.
- Non usare "tutte le precedenti", "nessuna delle precedenti" né riferimenti ad altre risposte (per esempio "A e B").
- Non usare formule, simboli, abbreviazioni, elenchi, emoji, grassetto o a capo dentro le celle: tutto deve poter essere letto ad alta voce senza ambiguità.
- Se il testo non contiene abbastanza informazioni per [NUMERO] domande diverse, scrivine di meno: non inventare e non ripetere.
- Segui l'ordine in cui gli argomenti compaiono nel testo.

FORMATO DI USCITA
Restituisci SOLO una tabella con queste 8 colonne, in quest'ordine e con questi titoli esatti:

Titolo | Domanda | Risposta A | Risposta B | Risposta C | Risposta D | Risposta Esatta | Riferimento

- Titolo: "Domanda 1", "Domanda 2", "Domanda 3"... (numerazione progressiva, senza anticipare la risposta).
- Domanda: il testo della domanda. Per le domande Vero/Falso scrivi "Vero o falso?" seguito dall'affermazione.
- Risposta A, B, C, D: il testo di ciascuna risposta, senza scrivere "A)" o "B)" davanti. Riempi le colonne sempre in ordine partendo da A, senza saltarne nessuna. Le colonne non usate devono restare completamente vuote: niente trattini, "N/A" o altro testo.
- Risposta Esatta: UNA SOLA LETTERA maiuscola, tra quelle delle risposte presenti in quella domanda (con 2 risposte solo A o B). Mai numeri, mai il testo della risposta.
- Riferimento: la frase del testo (massimo 15 parole) che giustifica la risposta corretta.
Non scrivere introduzioni, commenti o note prima o dopo la tabella.

TESTO
"""
[INCOLLA QUI IL TESTO]
"""
```

**Varianti utili**

- **Testo lungo:** meglio più richieste da 8–10 domande ciascuna che una sola da 30; la qualità resta più alta.
- **Altre domande sullo stesso testo:** nella stessa chat scrivi *"Scrivine altre 10 diverse dalle precedenti, stesso formato, numerando i titoli da Domanda 11"*. Incolla poi le nuove righe **sotto** quelle già presenti, senza ripetere l'intestazione.

---

## 2. Dalla risposta di Gemini al file Excel

1. Seleziona la tabella nella chat e copiala (oppure usa il pulsante di copia / "Esporta in Fogli" sotto la tabella, se compare).
2. Apri un foglio Excel nuovo, clicca la cella **A1** e incolla (`Ctrl+V`). L'intestazione deve stare nella **riga 1**, senza righe vuote sopra.
3. Fai i controlli del punto 3.
4. **File → Salva con nome → Cartella di lavoro di Excel (`.xlsx`)**.

> **Non salvare in CSV.** Excel in italiano separa le colonne con il punto e virgola, che Mimika non legge. Usa sempre `.xlsx`. Viene letto **solo il primo foglio** del file.

> **Se le risposte contengono frazioni o intervalli** (per esempio `3/4` o `10-12`), Excel li può trasformare in date. Prima di incollare, seleziona tutte le celle e imposta **Formato celle → Testo**.

---

## 3. Controlli prima di caricare

- [ ] **Riga 1 = intestazioni**, poi una domanda per riga. Nessuna riga di commento o testo dell'AI rimasto in giro.
- [ ] **Nessun "buco" nelle risposte.** Le risposte vuote vengono saltate e le altre scalano: se la C è vuota e la D piena, la D diventa C.
- [ ] **Celle inutilizzate davvero vuote.** Se l'AI scrive `-`, `N/A` o `—` in una colonna non usata, Mimika lo conta come una risposta. Cancella quelle celle.
- [ ] **Risposta Esatta = una lettera, tra quelle delle risposte presenti.** Con 2 risposte solo A o B, con 3 solo A, B o C. Non scrivere numeri: `1` viene letto come B, non come A.
- [ ] **Risposta Esatta non vuota.** Una cella vuota non dà errore: la domanda diventa "a scelta libera" e *qualsiasi* risposta dello studente viene accettata come valida.
- [ ] **Controlla tu che la risposta indicata sia davvero giusta.** L'AI sbaglia ogni tanto: la colonna *Riferimento* serve proprio a verificarlo velocemente. Poi puoi eliminarla (Mimika la ignora).
- [ ] **Un titolo breve e neutro**: viene letto ad alta voce prima di ogni domanda. Se lo lasci vuoto, Mimika scrive "Domanda 1", "Domanda 2"...

---

## 4. Caricamento in Mimika

- **Dal pannello docente:** *Importa domande da Excel* → trascina il file (o clicca per sceglierlo) → controlla l'anteprima → **Pubblica subito sul quiz** oppure **Aggiungi in coda**.
- **Dal PC dello studente:** schermata iniziale → **Carica file domande**.

Nell'anteprima ogni domanda mostra la risposta esatta con un ✓: se ne manca uno, quella domanda è "a scelta libera". Nel pannello docente trovi anche il pulsante **Modello Excel (.xlsx)** con il file vuoto già impostato.

---

## 5. Se Mimika segnala un errore

Il numero `N` nel messaggio è l'ordine della domanda: corrisponde alla **riga N+1** del foglio (la riga 1 è l'intestazione). Un solo errore blocca **tutto** il file: correggi e ricarica.

| Messaggio | Causa probabile | Rimedio |
|---|---|---|
| `Domanda N: servono da 2 a 4 risposte compilate` | Meno di 2 risposte scritte | Compila almeno A e B |
| `Domanda N: risposta corretta "D" non valida per 3 opzioni` | La lettera esatta non esiste tra le risposte presenti (per esempio D con solo 3 risposte, o un buco che ha fatto scalare le lettere) | Correggi la lettera o riempi le colonne senza buchi |
| `Domanda N: testo domanda mancante` | Cella *Domanda* vuota, oppure titolo di colonna scritto diversamente (di solito compare per la Domanda 1) | Controlla che le intestazioni siano uguali al modello |
| `Domanda N: risposta corretta "X" non valida` | Lettera oltre le risposte presenti, oppure scritta come `B)` o `Risposta B` | Scrivi solo la lettera, tra quelle disponibili |
| `Il file Excel non contiene righe con domande` | Foglio vuoto, oppure domande in un foglio diverso dal primo | Sposta le domande nel primo foglio |

---

## 6. Esempio di risultato atteso

Esempio con `[NUMERO RISPOSTE]` = `MISTO`: una domanda a 4 risposte, una a 3 e una Vero/Falso. Le colonne non usate restano vuote.

| Titolo | Domanda | Risposta A | Risposta B | Risposta C | Risposta D | Risposta Esatta | Riferimento |
|---|---|---|---|---|---|---|---|
| Domanda 1 | Quale fenomeno trasforma l'acqua liquida in vapore per effetto del calore del Sole? | La condensazione | L'evaporazione | Il congelamento | La precipitazione | B | Il calore del Sole fa evaporare l'acqua di mari e fiumi. |
| Domanda 2 | Che cosa accade al vapore quando sale in alto e si raffredda? | Torna subito sul terreno | Si scioglie nell'aria | Si condensa e forma le nuvole | | C | In quota il vapore si raffredda, condensa e forma le nuvole. |
| Domanda 3 | Vero o falso? Le nuvole restituiscono l'acqua alla Terra come pioggia, neve o grandine. | Vero | Falso | | | A | Le nuvole restituiscono l'acqua sotto forma di pioggia, neve o grandine. |
