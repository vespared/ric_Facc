# Installazione Windows

Questo progetto puo essere avviato su un PC Windows anche se Node.js non e ancora installato.

## File da usare

- `installa-ric-facc.cmd`: prima installazione completa
- `avvia-ric-facc.cmd`: avvii successivi del progetto (modalita kiosk)
- `avvia-server-rete.cmd`: avvio in rete con QR Code per il docente (apre automaticamente il browser studente all'acquisizione del QR code)

## Prima installazione

1. Copia l intera cartella del progetto sul PC Windows.
2. Esegui `installa-ric-facc.cmd`.
3. Conferma la richiesta di amministratore di Windows.
4. Lo script fa in automatico queste operazioni:
   - controlla se Node.js LTS e presente;
   - se manca, lo installa da internet con `winget` oppure con installer MSI ufficiale;
   - apre la porta `3000` nel firewall per le reti private;
   - crea un collegamento `Ric_Facc` sul Desktop;
   - avvia il server locale in una nuova finestra.

## Avvio quotidiano

Per usare il programma in seguito basta aprire:

- `avvia-ric-facc.cmd`
- oppure il collegamento `Ric_Facc` creato sul Desktop

## URL utili

Quando il server parte, nella finestra di comando mostra:

- `http://localhost:3000/` per il quiz studente sul PC
- `http://localhost:3000/teacher.html` per il pannello docente locale
- gli indirizzi LAN da usare su tablet o telefono nella stessa rete Wi-Fi

## Note tecniche

- Il backend usa solo Node.js e non richiede pacchetti `npm` esterni.
- Alcune librerie frontend vengono caricate da CDN internet al primo utilizzo.
- Se la porta `3000` e gia occupata, occorre chiudere l altro processo che la sta usando oppure cambiare porta.
