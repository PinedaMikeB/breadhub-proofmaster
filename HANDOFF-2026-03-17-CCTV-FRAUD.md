# BreadHub CCTV / Fraud System - HANDOFF
## Session: March 17, 2026

---

## RECOMMENDED HANDOFF LOCATION

This handoff belongs in the root of `breadhub-proofmaster` because:
- the future fraud review UI is planned as part of ProofMaster admin
- ProofMaster is the control plane that will eventually surface CCTV/fraud events
- the local CCTV runtime lives outside the repo, but it is part of the same operational system

Current handoff file:
- `D:\Codex\Github\breadhub-proofmaster\HANDOFF-2026-03-17-CCTV-FRAUD.md`

Important note:
- the actual CCTV runtime/data is not inside the repo
- it lives in `D:\CCTV\Shinobi`

---

## ARCHITECTURE DECISION

Current direction:
- ProofMaster remains the main operations/admin app
- fraud review should eventually surface from ProofMaster admin, likely as `/admin/fraud`
- CCTV ingestion/recording/detection runs locally on the store PC via Shinobi
- camera processing/storage should stay logically separate from the main frontend/backend app

Practical split:
- ProofMaster UI/admin: user management, operations, future fraud dashboard/review entry
- Local CCTV runtime: Shinobi + local recordings + motion regions
- Future fraud subsystem: event review, correlation with POS timestamps, possible alerts/scoring

---

## COMPLETED

### 1. ProofMaster authorization tightening

Implemented stricter client-side permissions and approval gating in:
- `D:\Codex\Github\breadhub-proofmaster\js\auth.js`
- `D:\Codex\Github\breadhub-proofmaster\js\app.js`
- `D:\Codex\Github\breadhub-proofmaster\js\users.js`
- `D:\Codex\Github\breadhub-proofmaster\index.html`

Also added Firebase project config/rules in:
- `D:\Codex\Github\breadhub-proofmaster\.firebaserc`
- `D:\Codex\Github\breadhub-proofmaster\firebase.json`
- `D:\Codex\Github\breadhub-proofmaster\firestore.rules`

Important context:
- stricter Firestore rules initially broke the live POS because POS shares the same Firebase project and uses direct Firestore PIN auth
- an emergency POS compatibility section was added back to `firestore.rules`

### 2. Firebase access and rules deployment

Authenticated Firebase CLI successfully and deployed rules to the `breadhub-proofmaster` project.

### 3. Shinobi local CCTV environment

Installed Docker Desktop and set up Shinobi using Docker Compose.

Local Shinobi runtime paths:
- `D:\CCTV\Shinobi\docker-compose.yml`
- `D:\CCTV\Shinobi\videos`
- `D:\CCTV\Shinobi\db`
- `D:\CCTV\Shinobi\config`

Purpose of those paths:
- `videos`: recorded footage
- `db`: Shinobi MariaDB data
- `config`: bind-mounted configuration path

### 4. Hikvision device discovery and activation

Installed and used SADP from:
- `D:\Installers\Hikvision\SADP\extracted\SADP.exe`

Detected camera:
- model: `DS-2CD1027G2-LUF`
- status: activated
- current LAN IP: `192.168.51.110`

Operational access:
- Hikvision web UI: `http://192.168.51.110`
- Shinobi local UI: `http://127.0.0.1:8080`

### 5. Camera and Shinobi setup

Configured first working monitor in Shinobi:
- monitor name: `Cashier Camera`
- input type: RTSP
- stream source: Hikvision RTSP main stream
- recording confirmed working
- clips confirmed in Shinobi `Videos`

Configured Hikvision basics:
- time corrected from `1970` and synced to current local time
- timezone set to `GMT+08:00`
- audio enabled
- preferred audio codec: `AAC`

Configured detector regions in Shinobi:
- `Drawer`
- `Cashier`
- `Handoff`

Intent of regions:
- `Drawer`: cash drawer / cash-handling area
- `Cashier`: cashier upper-body + POS interaction zone
- `Handoff`: customer exchange zone on counter

### 6. Storage direction

Recordings are intended to stay on `D:` via Shinobi:
- `D:\CCTV\Shinobi\videos`

Storage target:
- about `500 GB` cap configured at the Shinobi account level

---

## CURRENT LIVE ISSUE

As of March 17, 2026:
- the Hikvision camera is still on the network
- the local Shinobi web app is down because Docker Desktop / WSL 2 is stuck starting

Observed symptoms:
- `http://127.0.0.1:8080` returns connection refused
- Docker Desktop service is running, but Docker Linux engine never becomes ready
- Docker logs show repeated `docker starting` / `_ping HTTP 503`
- `wsl.exe --status` and `wsl.exe -l -v` hang from this shell

Conclusion:
- camera problem: no
- local host runtime problem: yes
- root cause appears to be a hung WSL 2 / Docker Desktop backend on this PC

Recommended recovery order:
1. Reboot the PC
2. Open Docker Desktop
3. Wait for Docker engine to become ready
4. Verify Shinobi at `http://127.0.0.1:8080`
5. If needed, restart Shinobi from `D:\CCTV\Shinobi\docker-compose.yml`

---

## IMPORTANT DIRECTORIES

### Repo / product
- `D:\Codex\Github\breadhub-proofmaster`
- `D:\Codex\Github\breadhub-proofmaster\HANDOFF-2026-03-17-CCTV-FRAUD.md`

### Local CCTV runtime
- `D:\CCTV\Shinobi`
- `D:\CCTV\Shinobi\docker-compose.yml`
- `D:\CCTV\Shinobi\videos`
- `D:\CCTV\Shinobi\db`
- `D:\CCTV\Shinobi\config`

### Camera tooling
- `D:\Installers\Hikvision\SADP\extracted\SADP.exe`

### Related repo files for auth/rules context
- `D:\Codex\Github\breadhub-proofmaster\js\auth.js`
- `D:\Codex\Github\breadhub-proofmaster\js\app.js`
- `D:\Codex\Github\breadhub-proofmaster\js\users.js`
- `D:\Codex\Github\breadhub-proofmaster\index.html`
- `D:\Codex\Github\breadhub-proofmaster\firestore.rules`

---

## KNOWN RUNTIME VALUES

Camera:
- IP: `192.168.51.110`
- UI: `http://192.168.51.110`
- username: `admin`
- password: not stored in repo or handoff

Shinobi:
- local URL: `http://127.0.0.1:8080`
- superuser URL: `http://127.0.0.1:8080/super`
- actual CCTV account was created manually in Shinobi UI
- credentials are intentionally not stored in repo or handoff

RTSP patterns used:
- main stream: `/Streaming/Channels/101`
- substream: `/Streaming/Channels/102`

---

## WHAT THE NEXT THREAD SHOULD UNDERSTAND

This is not yet a finished fraud system. It is a first operational CCTV foundation.

What exists now:
- one Hikvision cashier camera activated and reachable on LAN
- Shinobi local NVR setup and previously verified working
- recording and video retrieval verified
- audio enabled at camera level
- motion regions configured for first-pass monitoring

What does not exist yet:
- no ProofMaster `/admin/fraud` UI
- no incident review workflow
- no POS-to-video correlation logic
- no server-side fraud event model
- no automated under-ringing / no-sale / drawer anomaly logic
- no API-side Firebase token enforcement yet

---

## NEXT STEPS

### Immediate recovery
1. Recover Docker Desktop / WSL 2 so Shinobi comes back online
2. Verify the `Cashier Camera` monitor is live again
3. Re-check `Videos` and `Timeline`

### Near-term CCTV hardening
1. Improve camera angle to reduce the blocked right-side object/wall
2. Re-verify drawer visibility and POS interaction visibility
3. Tune false positives in Shinobi detector thresholds if needed
4. Consider using substream for lighter live view and main stream for recording

### Fraud-system integration planning
1. Add a ProofMaster handoff-aware plan for `/admin/fraud`
2. Define collections/tables for incidents, clips, event markers, cashier sessions
3. Correlate:
   - drawer-open moments
   - cashier-presence motion
   - handoff moments
   - POS sale timestamps
4. Build review workflow for suspicious sequences such as:
   - customer handoff without matching sale
   - drawer access without sale
   - extended cashier interaction with no POS transaction
   - under-ringing suspicion

### Security work still pending
1. API server still needs Firebase ID token verification
2. Firestore rules are partially relaxed for legacy POS compatibility
3. Fraud review data should eventually be admin-only and preferably API-mediated

---

## OPERATIONAL NOTES

- If `127.0.0.1:8080` fails, check Docker Desktop before assuming the camera failed.
- If camera video fails in Shinobi but `http://192.168.51.110` still works, the issue is likely RTSP/Shinobi-side, not the camera itself.
- Do not store camera or Shinobi passwords inside repo handoff files.

---

*Created: March 17, 2026*
