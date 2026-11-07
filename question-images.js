/*
 * Immagini nelle domande: modulo condiviso tra quiz studente (app.js) e pannello docente (teacher.js).
 *
 * Una domanda puo avere un campo `image` (percorso relativo "immagini/xxx.png", URL http(s) o data URI).
 *
 * Le immagini incorporate in un file Excel vengono estratte e caricate sul server (cartella immagini/):
 * le domande portano cosi solo un breve percorso e non superano i limiti di dimensione delle richieste.
 */
(function (global) {
    'use strict';

    const IMAGE_DIR = 'immagini';
    const UPLOAD_ENDPOINT = '/api/question-image';
    const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

    // Nomi di colonna / chiavi accettati (gia ridotti a minuscole alfanumeriche).
    const IMAGE_KEYS = ['image', 'immagine', 'img', 'foto', 'urlimmagine', 'imageurl', 'fileimmagine', 'nomeimmagine'];

    const MIME_BY_EXTENSION = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp'
    };

    const NS_RELATIONSHIPS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const EXCEL_ERROR_PATTERN = /^#(NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A)$/i;

    function normalizeKey(value) {
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    // Riduce il valore scritto dal docente a un percorso utilizzabile dal browser.
    // Un nome file (o un percorso, anche Windows) diventa "immagini/<nome>": il file deve stare in quella cartella.
    function normalizeReference(value) {
        const text = String(value ?? '').trim();
        if (!text || EXCEL_ERROR_PATTERN.test(text)) {
            return '';
        }
        if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(text)) {
            return text;
        }
        if (/^https?:\/\//i.test(text)) {
            return text;
        }
        const fileName = text.split(/[\\/]/).pop().split(/[?#]/)[0].trim();
        return fileName ? `${IMAGE_DIR}/${fileName}` : '';
    }

    // Legge il riferimento all'immagine da un oggetto domanda grezzo (JSON, riga Excel, blocco TXT...).
    function readQuestionImage(rawQuestion) {
        const key = Object.keys(rawQuestion || {}).find((name) => IMAGE_KEYS.includes(normalizeKey(name))
            && normalizeReference(rawQuestion[name]));
        return key ? normalizeReference(rawQuestion[key]) : '';
    }

    function toUint8Array(content) {
        if (!content) {
            return null;
        }
        return content instanceof Uint8Array ? content : Uint8Array.from(content);
    }

    function bytesToDataUrl(bytes, mime) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Impossibile leggere l\'immagine.'));
            reader.readAsDataURL(new Blob([bytes], { type: mime }));
        });
    }

    function formatMegabytes(bytes) {
        return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',');
    }

    // Carica i byte di un'immagine sul server e restituisce il percorso da salvare nella domanda.
    async function uploadBytes(bytes, mime) {
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw new Error(`Immagine troppo grande (${formatMegabytes(bytes.length)} MB, massimo ${formatMegabytes(MAX_IMAGE_BYTES)} MB).`);
        }

        // Senza server (pagina aperta come file locale) l'immagine resta incorporata nella domanda.
        if (global.location && global.location.protocol === 'file:') {
            return bytesToDataUrl(bytes, mime);
        }

        let response;
        try {
            response = await fetch(UPLOAD_ENDPOINT, {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': mime },
                body: bytes
            });
        } catch (error) {
            throw new Error('Server non raggiungibile: impossibile salvare l\'immagine.');
        }

        let payload = {};
        try {
            payload = await response.json();
        } catch (error) {
            // risposta non JSON: gestita sotto
        }
        if (!response.ok || !payload.url) {
            throw new Error(payload.error || `Salvataggio immagine non riuscito (${response.status}).`);
        }
        return payload.url;
    }

    async function uploadFile(file) {
        const extension = String(file.name.split('.').pop() || '').toLowerCase();
        const mime = MIME_BY_EXTENSION[extension] || (/^image\/(png|jpeg|gif|webp)$/.test(file.type) ? file.type : '');
        if (!mime) {
            throw new Error('Formato immagine non supportato. Usa PNG, JPG, GIF o WEBP.');
        }
        return uploadBytes(new Uint8Array(await file.arrayBuffer()), mime);
    }

    /* ---------- Lettura delle immagini incorporate in un .xlsx ---------- */

    function createZipReader(files) {
        const lookup = (path) => files[path] || files[`/${path}`] || null;
        return {
            bytes(path) {
                const entry = lookup(path);
                return entry ? toUint8Array(entry.content) : null;
            },
            text(path) {
                const content = this.bytes(path);
                return content ? new TextDecoder('utf-8').decode(content) : null;
            },
            xml(path) {
                const text = this.text(path);
                return text ? new DOMParser().parseFromString(text, 'application/xml') : null;
            }
        };
    }

    function byName(root, localName) {
        return root ? Array.from(root.getElementsByTagNameNS('*', localName)) : [];
    }

    function childrenByName(element, localName) {
        return Array.from(element.children).filter((child) => child.localName === localName);
    }

    function relationshipAttribute(element, name) {
        return element.getAttributeNS(NS_RELATIONSHIPS, name) || element.getAttribute(`r:${name}`) || '';
    }

    function resolveTarget(baseDir, target) {
        if (target.startsWith('/')) {
            return target.slice(1);
        }
        const parts = baseDir.split('/').filter(Boolean);
        target.split('/').forEach((segment) => {
            if (segment === '..') {
                parts.pop();
            } else if (segment && segment !== '.') {
                parts.push(segment);
            }
        });
        return parts.join('/');
    }

    function readRelationships(zip, ownerPath) {
        const slash = ownerPath.lastIndexOf('/');
        const baseDir = ownerPath.slice(0, slash);
        const relsPath = `${baseDir}/_rels/${ownerPath.slice(slash + 1)}.rels`;
        const relations = new Map();
        byName(zip.xml(relsPath), 'Relationship').forEach((node) => {
            relations.set(node.getAttribute('Id'), {
                type: node.getAttribute('Type') || '',
                target: resolveTarget(baseDir, node.getAttribute('Target') || '')
            });
        });
        return relations;
    }

    function findSheetPath(zip, sheetName) {
        const workbookPath = 'xl/workbook.xml';
        const sheets = byName(zip.xml(workbookPath), 'sheet');
        const sheet = sheets.find((node) => node.getAttribute('name') === sheetName) || sheets[0];
        if (!sheet) {
            return null;
        }
        const relation = readRelationships(zip, workbookPath).get(relationshipAttribute(sheet, 'id'));
        return relation ? relation.target : null;
    }

    function mimeForPath(path) {
        const extension = String(path.split('.').pop() || '').toLowerCase();
        return MIME_BY_EXTENSION[extension] || '';
    }

    function readMedia(zip, path, warnings) {
        const mime = mimeForPath(path);
        if (!mime) {
            warnings.push(`Immagine ${path.split('/').pop()} ignorata: formato non supportato (usa PNG, JPG, GIF o WEBP).`);
            return null;
        }
        const bytes = zip.bytes(path);
        return bytes ? { bytes, mime } : null;
    }

    // Immagini "mobili" (Inserisci > Immagini, posizionate sopra le celle): agganciate a una riga del foglio.
    function collectFloatingImages(zip, sheetPath, warnings) {
        const drawingRelation = Array.from(readRelationships(zip, sheetPath).values())
            .find((relation) => /\/drawing$/.test(relation.type));
        if (!drawingRelation) {
            return [];
        }

        const drawing = zip.xml(drawingRelation.target);
        const mediaRelations = readRelationships(zip, drawingRelation.target);
        const found = [];

        byName(drawing, 'wsDr').forEach((root) => {
            Array.from(root.children).forEach((anchor) => {
                const blip = byName(anchor, 'blip')[0];
                if (!blip) {
                    return;
                }
                const relation = mediaRelations.get(relationshipAttribute(blip, 'embed'));
                const from = childrenByName(anchor, 'from')[0];
                const rowNode = from ? childrenByName(from, 'row')[0] : null;
                if (!relation || !rowNode) {
                    warnings.push('Un\'immagine nel foglio non e agganciata a una cella: spostala sulla riga della domanda.');
                    return;
                }

                const firstRow = Number(rowNode.textContent);
                let lastRow = firstRow;
                const to = childrenByName(anchor, 'to')[0];
                if (to) {
                    const toRow = Number(childrenByName(to, 'row')[0].textContent);
                    const toOffset = Number((childrenByName(to, 'rowOff')[0] || { textContent: '0' }).textContent);
                    lastRow = toRow > firstRow && toOffset === 0 ? toRow - 1 : toRow;
                }

                const media = readMedia(zip, relation.target, warnings);
                if (media) {
                    found.push({ firstRow, lastRow, ...media });
                }
            });
        });

        return found;
    }

    // Immagini "nella cella" (Excel 365, Posiziona nella cella): memorizzate come valori ricchi (richData).
    function collectInCellImages(zip, sheetPath, warnings) {
        const sheet = zip.xml(sheetPath);
        const cells = byName(sheet, 'c').filter((cell) => cell.hasAttribute('vm'));
        if (!cells.length) {
            return [];
        }

        const metadata = zip.xml('xl/metadata.xml');
        const valueBlocks = byName(byName(metadata, 'valueMetadata')[0], 'bk');
        const futureBlocks = byName(
            byName(metadata, 'futureMetadata').find((node) => node.getAttribute('name') === 'XLRICHVALUE'),
            'bk'
        );
        const richValues = byName(zip.xml('xl/richData/rdrichvalue.xml'), 'rv');
        const structures = byName(zip.xml('xl/richData/rdrichvaluestructure.xml'), 's');
        const relNodes = byName(zip.xml('xl/richData/richValueRel.xml'), 'rel');
        const mediaRelations = readRelationships(zip, 'xl/richData/richValueRel.xml');
        const found = [];

        cells.forEach((cell) => {
            try {
                const valueBlock = valueBlocks[Number(cell.getAttribute('vm')) - 1];
                const richIndex = Number(byName(futureBlocks[Number(byName(valueBlock, 'rc')[0].getAttribute('v'))], 'rvb')[0].getAttribute('i'));
                const richValue = richValues[richIndex];
                const structure = structures[Number(richValue.getAttribute('s'))];
                const keyIndex = byName(structure, 'k').findIndex((key) => key.getAttribute('n') === '_rvRel:LocalImageIdentifier');
                const relNode = relNodes[Number(childrenByName(richValue, 'v')[keyIndex].textContent)];
                const relation = mediaRelations.get(relationshipAttribute(relNode, 'id'));
                const media = relation ? readMedia(zip, relation.target, warnings) : null;
                const row = Number((cell.getAttribute('r').match(/\d+/) || ['0'])[0]) - 1;
                if (media && row >= 0) {
                    found.push({ firstRow: row, lastRow: row, ...media });
                }
            } catch (error) {
                warnings.push(`Immagine nella cella ${cell.getAttribute('r')} non leggibile.`);
            }
        });

        return found;
    }

    // Collega le immagini incorporate nel foglio alle domande (stessa riga) e le carica sul server.
    // `rows` e `questions` hanno lo stesso ordine; ogni riga porta `__rowNum__` (riga del foglio, base 0).
    async function attachWorkbookImages(workbook, sheetName, rows, questions) {
        const warnings = [];
        const files = workbook && workbook.files;
        if (!files || !files['xl/workbook.xml']) {
            return { attached: 0, warnings };
        }

        let images = [];
        try {
            const zip = createZipReader(files);
            const sheetPath = findSheetPath(zip, sheetName);
            if (sheetPath) {
                images = [
                    ...collectFloatingImages(zip, sheetPath, warnings),
                    ...collectInCellImages(zip, sheetPath, warnings)
                ];
            }
        } catch (error) {
            warnings.push('Impossibile leggere le immagini incorporate nel file Excel.');
        }

        const questionIndexByRow = new Map();
        rows.forEach((row, index) => {
            if (typeof row.__rowNum__ === 'number') {
                questionIndexByRow.set(row.__rowNum__, index);
            }
        });

        let attached = 0;
        for (const image of images) {
            let target = -1;
            for (let row = image.firstRow; row <= image.lastRow && target < 0; row += 1) {
                if (questionIndexByRow.has(row)) {
                    target = questionIndexByRow.get(row);
                }
            }

            if (target < 0) {
                warnings.push(`Un'immagine alla riga ${image.firstRow + 1} non corrisponde a nessuna domanda.`);
                continue;
            }
            if (questions[target].image) {
                warnings.push(`Domanda ${target + 1}: ha gia un'immagine, quella in piu e ignorata.`);
                continue;
            }

            questions[target].image = await uploadBytes(image.bytes, image.mime);
            attached += 1;
        }

        return { attached, warnings };
    }

    // Controlla che le immagini indicate per nome esistano nella cartella immagini/ del server.
    async function findMissingImages(questions) {
        if (!global.location || !/^https?:$/.test(global.location.protocol)) {
            return [];
        }

        const warnings = [];
        const references = [...new Set(questions.map((question) => question.image).filter((image) => image && image.startsWith(`${IMAGE_DIR}/`)))];
        await Promise.all(references.map(async (reference) => {
            try {
                const response = await fetch(reference, { method: 'HEAD', cache: 'no-store' });
                if (!response.ok) {
                    warnings.push(`Immagine non trovata: ${reference}. Copiala nella cartella "${IMAGE_DIR}" del programma.`);
                }
            } catch (error) {
                // rete non disponibile: nessun avviso, il controllo e solo informativo
            }
        }));
        return warnings;
    }

    global.RicFaccImages = {
        IMAGE_DIR,
        IMAGE_KEYS,
        MAX_IMAGE_BYTES,
        normalizeReference,
        readQuestionImage,
        uploadFile,
        attachWorkbookImages,
        findMissingImages
    };
}(window));
