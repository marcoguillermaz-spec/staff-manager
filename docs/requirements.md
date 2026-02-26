# Staff Manager — Specifica di Prodotto

> Documento di riferimento per l'implementazione. Leggere le sezioni pertinenti al blocco in lavorazione prima di iniziare la Fase 2 (Implementazione).
> Aggiornare questo file se i requisiti cambiano in corso d'opera.

---

## 1. Brief di progetto

**Contesto.** Gestionale amministrativo unico per i collaboratori COMMUNITY (Testbusters e Peer4Med). Dati oggi dispersi, flussi (approvazioni, pagamenti, documenti, ticket) non tracciati in modo chiaro.

**Obiettivo.** Ridurre attrito ed errori: richieste standardizzate, export pagamenti pulito, documenti archiviati e firmati, comunicazioni e risorse in un posto solo.

**Problemi da risolvere:**
- Collaboratori modificano autonomamente i propri dati senza passare dall'amministrazione
- Inserimento dichiarazione figli a carico (con soglie età/reddito visibili) e P.IVA (con spiegazione procedura)
- Uniformare il meccanismo di caricamento file compensi (oggi diverso tra Corsi ed Extra)
- Collaboratori vedono in front-end quanto liquidato e quanto ancora da ricevere
- Slot rimborsi integrato (non form Google separato)

**Utenti.** Collaboratori (non tecnici), Responsabile Cittadino, Responsabile Compensi, Responsabile Servizi Individuali, Amministrazione (Finance/HR).

**Criteri di accettazione UX:**
- Collaboratore inserisce un compenso in < 60 secondi (wizard 3 step)
- Responsabile pre-approva 20 richieste in 5 minuti (azioni inline + filtri)
- Admin esporta "da pagare" in 2 click e segna pagato singolo o massivo

---

## 2. Ruoli e permessi (RBAC)

| Ruolo | Label UI | Visibilità | Note |
|---|---|---|---|
| `collaboratore` | Collaboratore | Propri record | As-is |
| `responsabile_cittadino` | Responsabile Cittadino | Da definire | Permessi da definire |
| `responsabile_compensi` | Responsabile Compensi | Community assegnate da admin | Ex `responsabile` |
| `responsabile_servizi_individuali` | Responsabile Servizi Individuali | Da definire | Permessi da definire |
| `amministrazione` | Admin | Tutte le community | As-is |

**Regole chiave:**
- RLS reale su ogni tabella — nessun accesso a record altrui via URL
- Collaboratore vede solo i propri record; IBAN e documenti visibili solo a collaboratore proprietario + admin
- Responsabile Compensi vede solo le community assegnate e fa pre-approvazione obbligatoria
- Timeline stato senza nominativi: mostrare solo il label del ruolo (es. "Responsabile Compensi" / "Amministrazione")
- La community è autonoma nel creare/caricare allegati e nel settare i ruoli di ogni persona (non richiedere intervento tecnico per nuovi ruoli)

**Gestione uscenti (member_status):**
- `uscente_con_compenso` — ha ancora compensi da ricevere; non vede documenti relativi al nuovo anno; accesso limitato ai propri record in corso
- `uscente_senza_compenso` — nessun compenso pendente; account disabilitato tranne accesso in sola lettura alla pagina documenti storici
- `attivo` — accesso completo per ruolo

**Nuovi ingressi:** nella realtà avvengono in modo sporadico durante tutto l'anno (non 1-2 volte come previsto teoricamente). La community deve poter gestire in autonomia: registrazione anagrafica, generazione contratto, assegnazione ruolo.

### Utenze di test

| Email | Tipo | Ruolo | Stato |
|---|---|---|---|
| `collaboratore@test.com` | Playwright | collaboratore | as-is |
| `responsabile_cittadino@test.com` | Playwright | responsabile_cittadino | da creare |
| `responsabile_compensi@test.com` | Playwright | responsabile_compensi | rinomina da `responsabile@test.com` |
| `responsabile_servizi_individuali@test.com` | Playwright | responsabile_servizi_individuali | da creare |
| `admin@test.com` | Playwright | amministrazione | rinomina da `admin-test@example.com` |
| `collaboratore_test@test.com` | Manuale | collaboratore | as-is |
| `responsabile_cittadino_test@test.com` | Manuale | responsabile_cittadino | da creare |
| `responsabile_compensi_test@test.com` | Manuale | responsabile_compensi | rinomina da `responsabile_test@test.com` |
| `responsabile_servizi_individuali_test@test.com` | Manuale | responsabile_servizi_individuali | da creare |
| `admin_test@test.com` | Manuale | amministrazione | as-is |

### Punti aperti
- `responsabile_cittadino`: permessi e visibilità da definire
- `responsabile_servizi_individuali`: permessi e visibilità da definire

---

## 3. Modello dati

```sql
Community(id, name)
UserProfile(id, user_id, role, is_active, member_status, must_change_password, created_at)
UserCommunityAccess(id, user_id, community_id)   -- per Responsabili/Admin
Collaborator(id, user_id, nome, cognome, codice_fiscale, partita_iva?, data_nascita?,
             indirizzo, telefono, email, iban, note, tshirt_size, foto_profilo_url,
             data_ingresso, ha_figli_a_carico, figli_dettaglio jsonb?, created_at)
CollaboratorCommunity(id, collaborator_id, community_id)

Compensation(id, collaborator_id, community_id, tipo[OCCASIONALE|PIVA],
             descrizione, periodo_riferimento, data_competenza,
             importo_lordo, ritenuta_acconto?, importo_netto?,
             numero_fattura?, data_fattura?, imponibile?, iva_percentuale?, totale_fattura?,
             stato, manager_approved_by/at, admin_approved_by/at,
             integration_note, integration_reasons[],
             paid_at, paid_by, payment_reference?, note_interne?, created_at)
CompensationAttachment(id, compensation_id, file_url, file_name, created_at)
CompensationHistory(id, compensation_id, stato_precedente, stato_nuovo,
                    changed_by, role_label, note?, created_at)

ExpenseReimbursement(id, collaborator_id, categoria, descrizione, data_spesa, importo,
                     stato, manager_approved_by/at, admin_approved_by/at,
                     integration_note, paid_at, paid_by, payment_reference?, created_at)
ExpenseAttachment(id, reimbursement_id, file_url, file_name, created_at)
ExpenseHistory(id, reimbursement_id, stato_precedente, stato_nuovo,
               changed_by, role_label, note?, created_at)

Document(id, collaborator_id, community_id, tipo[CONTRATTO_OCCASIONALE|RICEVUTA_PAGAMENTO|CU],
         anno?, titolo, file_original_url, stato_firma[DA_FIRMARE|FIRMATO|NON_RICHIESTO],
         file_firmato_url?, requested_at, signed_at?, note?, created_at)

Ticket(id, creator_user_id, community_id, categoria, oggetto,
       stato[APERTO|IN_LAVORAZIONE|CHIUSO], priority[BASSA|NORMALE|ALTA], created_at)
TicketMessage(id, ticket_id, author_user_id, message, attachment_url?, created_at)

Announcement(id, community_id nullable, titolo, contenuto, pinned bool, published_at, created_at)
Benefit(id, community_id nullable, titolo, descrizione, codice_sconto?, link?,
        valid_from?, valid_to?, created_at)
Resource(id, community_id nullable, titolo, descrizione, link?, file_url?, tag?, created_at)
Event(id, community_id nullable, titolo, descrizione, start_datetime?, end_datetime?,
      location?, luma_url?, luma_embed_url?, created_at)
```

---

## 4. Workflow operativi

### 4.1 Compensi

```
BOZZA → INVIATO → PRE_APPROVATO_RESP → APPROVATO_ADMIN → PAGATO
                ↘ INTEGRAZIONI_RICHIESTE ↗  ↘ RIFIUTATO
```

| Azione | Da stato | A stato | Ruolo |
|---|---|---|---|
| submit | BOZZA | INVIATO | collaboratore |
| withdraw | INVIATO | BOZZA | collaboratore |
| resubmit | INTEGRAZIONI_RICHIESTE | INVIATO | collaboratore |
| approve_manager | INVIATO / INTEGRAZIONI_RICHIESTE | PRE_APPROVATO_RESP | responsabile_compensi |
| request_integration | INVIATO / INTEGRAZIONI_RICHIESTE | INTEGRAZIONI_RICHIESTE | responsabile_compensi / amministrazione |
| approve_admin | PRE_APPROVATO_RESP | APPROVATO_ADMIN | amministrazione |
| reject | PRE_APPROVATO_RESP | RIFIUTATO | amministrazione |
| mark_paid | APPROVATO_ADMIN | PAGATO | amministrazione |

Integrazioni richieste: obbligatorio testo "Cosa manca" (≥ 20 caratteri) + checklist motivi [Allegato mancante, Dati incompleti, Importo non coerente, Periodo non valido, Altro].

### 4.2 Rimborsi

Flusso identico ai compensi, senza stato BOZZA (creati direttamente come INVIATO). Allegati ricevute. Export dedicato "Da pagare".

### 4.3 Documenti

- **Admin** carica PDF (`file_original_url`) e imposta `DA_FIRMARE`
- **Collaboratore** scarica PDF originale, firma offline, ricarica PDF firmato → stato `FIRMATO` (`signed_at` automatico)
- **Notifica in-app** ad Admin quando il documento viene firmato
- **NON_RICHIESTO**: documenti informativi (ricevute di pagamento, CU) che non richiedono firma

**CU batch (Certificazione Unica):**
- Contabilità invia una cartella ZIP con tutti i PDF + un file CSV con la mappa `nome_pdf → nome_cognome_utente`
- Il sistema deve permettere upload ZIP + CSV e associare automaticamente ogni PDF al collaboratore corretto (match su `nome_cognome`)
- Dedup: se un CU per lo stesso collaboratore e anno esiste già, non sovrascrivere (segnalare come duplicato)
- **Nota operativa:** fare un passaggio con contabilità per allinare il formato esatto del CSV prima dell'implementazione. Il formato attuale del nome file è `nome_cognome` (nome utente gestionale).

**Allegati contratto:**
- Logica allegati invece di 100 template contratto diversi: l'admin carica il PDF del contratto specifico e lo assegna al collaboratore
- Filtro risorse per ruolo: ogni documento/risorsa è visibile solo ai ruoli abilitati
- La community gestisce autonomamente creazione allegati, upload, assegnazione ruoli — senza intervento tecnico

### 4.4 Ticket

Thread messaggi + allegati, stati APERTO / IN_LAVORAZIONE / CHIUSO, notifiche in-app minime.

### 4.5 Export

**Compensi "Da pagare"** (stato = APPROVATO_ADMIN):
- Occasionali: Nome, Cognome, CF, Community, Periodo, Causale, Data competenza, Lordo, Ritenuta, Netto, IBAN
- P.IVA: Nome/Cognome, P.IVA, Community, N. fattura, Data fattura, Imponibile, IVA%, Totale, IBAN, Note

**Rimborsi "Da pagare"** (stato = APPROVATO_ADMIN):
- Nome, Cognome, CF, Community, Categoria, Data spesa, Importo, IBAN, Note

---

## 5. Pagine e navigazione

### Collaboratore (8 voci)
| Voce | Route | Contenuto |
|---|---|---|
| Home | `/` | Dashboard: card metriche, azioni rapide, feed |
| Profilo e Documenti | `/profilo` | Tab **Profilo** (dati anagrafici, IBAN, figli a carico) + Tab **Documenti** (DocumentList storico firmato) |
| Compensi e Rimborsi | `/compensi` | PaymentOverview + lista compensi (tutti gli stati) + lista rimborsi + pulsante "Apri ticket" (TicketQuickModal) |
| Corsi | `#` | Coming soon — voce visibile, non cliccabile |
| Schoolbusters | `#` | Coming soon — voce visibile, non cliccabile |
| Eventi | `/eventi` | Lista eventi community (read-only, ordinati per data ASC) |
| Comunicazioni e Risorse | `/comunicazioni` | Tab **Comunicazioni** (bacheca annunci, read-only) + Tab **Risorse** (guide e materiali, read-only) |
| Opportunità e Sconti | `/opportunita` | Lista benefit e agevolazioni (read-only) |

**Regole navigazione collaboratore:**
- Il collaboratore **non crea** compensi — `/compensi/nuova` reindirizza a `/compensi`
- I rimborsi sono visibili in `/compensi`; `/rimborsi` reindirizza a `/compensi`
- I documenti sono accessibili solo da `/profilo?tab=documenti`; `/documenti` reindirizza lì
- I ticket si aprono tramite modale da `/compensi`, non da una pagina dedicata
- `uscente_senza_compenso`: accesso solo a `/profilo?tab=documenti`

### Responsabile Compensi (max 7 voci)
Approvazioni (tab Compensi/Rimborsi), Collaboratori (community assegnate), Ticket, Contenuti.

### Responsabile Cittadino / Responsabile Servizi Individuali
Navigazione da definire al momento della specifica funzionale dei ruoli.

### Amministrazione (max 7 voci)
Coda lavoro (tab: Da approvare / Documenti da firmare / Ticket aperti), Collaboratori, Export, Documenti, Ticket, Contenuti, Impostazioni.

---

## 6. Requisiti UX (vincolanti)

- **Anonimato**: collaboratore non vede nome/email di chi approva. Timeline mostra solo "Responsabile" / "Amministrazione"
- **Integrazioni**: testo ≥ 20 caratteri + checklist motivi obbligatoria. Il collaboratore vede banner + elenco puntato + bottone unico "Carica integrazione"
- **Pagamenti**: admin può "Segna pagato" singolo (da dettaglio) e massivo (multi-selezione). `paid_at` automatico. `payment_reference` opzionale ma consigliato
- **Filtro default**: "Solo cose che richiedono la mia azione" attivo di default per Responsabile e Admin
- **Wizard**: max 3 step per creare richieste (Dati → Allegati → Riepilogo e invio)
- **Timeline**: sempre visibile nel dettaglio richiesta

---

## 7. Sicurezza

- RLS su tutte le tabelle
- IBAN e documenti: accesso solo ad admin e collaboratore proprietario
- Storage privato Supabase (signed URL, nessun bucket pubblico)
- Log: chi approva, quando, chi marca pagato

---

## 8. Notifiche (in-app, minimo)

### 8.1 Trigger eventi
- Integrazioni richieste (cambio stato)
- Documento da firmare assegnato
- Documento firmato ricevuto (notifica ad admin)
- Risposta ticket
- Cambio stato generico richiesta

### 8.2 Comportamento UI campanello
- **Link entità**: tutte le notifiche con `entity_type` valorizzato sono cliccabili:
  `compensation → /compensi/:id`, `reimbursement → /rimborsi/:id`, `document → /documenti/:id`, `ticket → /ticket/:id`
- **Mark-read singola**: cliccare una notifica la marca come letta; nessun auto-mark-all-read all'apertura del dropdown
- **"Segna tutte come lette"**: pulsante esplicito nell'header del dropdown, visibile solo se `unread > 0`
- **Stato loading/errore**: indicatore visivo durante il primo fetch; messaggio se la fetch fallisce
- **Dismiss singola**: pulsante × (visibile on hover) per rimuovere definitivamente una notifica
- **Avviso lista troncata**: se il dropdown raggiunge il limite (50 notifiche), mostrare banner + link "Vedi tutte"
- **Pagina completa**: link "Vedi tutte →" in fondo al dropdown → `/notifiche` con:
  - Paginazione (20 per pagina)
  - Toggle "Solo non lette"
  - Mark-read singola e dismiss per ogni voce

---

## 9. Fuori perimetro attuale (note per futuro)

**Definizione corso unificata (idea mai implementata):**
- Staff: definizione corso → chi ha fatto il corso → pagamenti
- Simu: definizione corso → gestione aule → notifiche a studenti e docenti
- Oggi i pagamenti Simu sono relativi a una definizione corso separata
- Non implementare in Phase 1-2; valutare in Phase 3+

---

## 10. Note operative

- **Lingua UI**: italiano. Codice/commit: inglese.
- **Storage**: bucket privati Supabase con signed URL. Mai link pubblici per documenti.
- **CU batch**: allineare con contabilità il formato CSV prima di implementare il batch import.
- **Nuovi ingressi**: flusso di onboarding deve essere completabile in autonomia dall'admin senza intervento tecnico (registrazione anagrafica + generazione contratto + assegnazione ruolo).

---

## 11. Dashboard collaboratore (Phase 3)

Pagina principale del collaboratore. Attualmente placeholder "In costruzione".

### Card di riepilogo (3 card grandi)
Ogni card mostra: conteggio richieste attive + importo totale in euro + conteggio richieste in attesa di pagamento (APPROVATO_ADMIN) + relativo importo.

- **Compensi**: richieste attive (stato ≠ PAGATO, ≠ RIFIUTATO) + di cui in attesa pagamento
- **Rimborsi**: stessa logica compensi, conteggi e importi separati
- **Documenti da firmare**: solo conteggio documenti in stato DA_FIRMARE

### Azioni rapide
- Nuovo compenso → `/compensi/nuova`
- Nuovo rimborso → `/rimborsi/nuova`
- Apri ticket → `/ticket/nuova`

### "Cosa mi manca"
Sezione che segnala azioni richieste al collaboratore. Trigger:
- Richieste in stato INTEGRAZIONI_RICHIESTE → "Hai X richiesta/e che richiedono integrazione"
- Documenti in stato DA_FIRMARE → "Hai X documento/i da firmare"
- Ticket aperti senza risposta del collaboratore (ultimo messaggio non è dell'utente corrente)
- Profilo incompleto: campi obbligatori mancanti (IBAN, codice fiscale) → "Completa il tuo profilo"
  - Nota: una volta implementato l'onboarding, il profilo sarà sempre completo all'attivazione. Il check rimane come fallback.

### Ultimi aggiornamenti (feed)
Mostrare le ultime 10 voci aggregate da:
- Cambi stato su compensi e rimborsi propri (da `compensation_history` / `expense_history`)
- Risposte ai propri ticket (nuovi `ticket_messages` da altri utenti)
- Nuovi annunci in bacheca (`announcements`, max 3, pinned first)

---

## 12. Profilo collaboratore esteso (Phase 3)

Estensione del profilo attuale (IBAN, tel, indirizzo, tshirt_size).

### Schema DB — note
Tutti i campi (`ha_figli_a_carico`, `figli_dettaglio`, `data_ingresso`, `foto_profilo_url`, `partita_iva`) erano già presenti in `001_schema.sql` e nel DB live. Solo il bucket `avatars` è stato aggiunto con migration `008`.

### Dati fiscali — Sono fiscalmente a carico
- Semantica: il collaboratore dichiara se È fiscalmente a carico di un familiare (es. genitore). Non se "ha figli a carico".
- Campo DB: `ha_figli_a_carico` boolean (nome storico mantenuto per compatibilità)
- Checkbox "Sono fiscalmente a carico" + testo esplicativo
- Se true: mostrare collassabile una guida con soglie reddito/età — contenuto gestito dall'admin tramite Contenuti > Guide (tag: `detrazioni-figli`)

### Info P.IVA
- Campo `partita_iva` (testo, opzionale) già nel modello: editabile dal collaboratore
- Se `partita_iva` valorizzato: mostrare banner "Sei registrato come P.IVA" + contenuto di una guida gestita dall'admin (tag: `procedura-piva`). Stesso meccanismo del punto precedente.

### Data ingresso
- Campo `data_ingresso` (date): impostato dall'admin nel form di creazione utente
- Modificabile dall'admin o responsabile nella pagina Impostazioni > Collaboratori (MemberStatusManager o sezione dedicata)
- Read-only per il collaboratore nel proprio profilo

### Foto profilo
- Campo `foto_profilo_url` nel record collaboratore
- Upload da parte del collaboratore nel proprio profilo (Supabase Storage, bucket `avatars` pubblico o signed URL)
- Non obbligatoria; mostrata in Sidebar se presente, altrimenti iniziali

### Panoramica pagamenti — pagina Compensi
Sezione "I miei pagamenti" posizionata in testa alla pagina `/compensi`, con due card:
- **Compensi ricevuti**: breakdown per anno — totale PAGATO per anno corrente e anni precedenti
- **Rimborsi ricevuti**: stesso breakdown per anno

Importi "in attesa" (INVIATO + INTEGRAZIONI_RICHIESTE + PRE_APPROVATO_RESP + APPROVATO_ADMIN) mostrati separatamente sotto le card come riga riepilogativa.
Calcolato dinamicamente — nessun campo persisted.
