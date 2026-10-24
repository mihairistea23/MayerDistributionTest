# Firebase Sync - implementation notes

This branch contains the first isolated implementation layer for Firebase sync. It is intentionally not wired into the v1.5 UI yet, so opening the app does not change its local-only behavior.

## Why integration is staged

The current app writes to `localStorage` from many paths (new program, delete program, nomenclature edits, restore backup). Turning on background sync before defining conflict handling and deletion semantics could overwrite or resurrect data across devices. Therefore this first implementation adds a user-scoped Firebase service and a matching security-rules template; UI integration follows after this layer is reviewed and configured.

## Files

- `firebase-sync.js`: Firebase Auth + Firestore service; user-scoped paths; local snapshot upload and realtime subscriptions.
- `firebase-config.example.js`: client config template only. Copy to `firebase-config.js` locally and fill in values from a dedicated Firebase project. Never add service-account credentials.
- `firestore.rules.example`: rules scoped to each authenticated UID.
- Existing `index.html` remains unchanged in this commit.

## Required Firebase setup

1. Use a dedicated Firebase project for MayerDistribution sync, not the prototype project whose rules currently only allow `syncTest`.
2. Enable Email/Password authentication and create authorized test users.
3. Create Firestore in production mode.
4. Review `firestore.rules.example` and publish equivalent rules in the dedicated project before connecting the service.
5. Copy `firebase-config.example.js` to `firebase-config.js` locally and fill in the Firebase web-app config.
6. Do not commit `firebase-config.js` if it contains environment-specific settings; the service-account private key must never be used in the browser.

## Data layout

- `users/{uid}/appData/lists`: one document containing nomenclatures.
- `users/{uid}/programs/{programId}`: one document per saved program, preserving its ID.
- `users/{uid}/syncMeta/current`: metadata for the latest import.

The service intentionally does not perform automatic writes or merge local/cloud data on initialization. Upload is an explicit operation. Before production use, the UI must provide a clear import preview, collision handling, conflict policy, and tests for offline/reconnect and deletes.

## Current status

The branch now includes a guarded setup panel in the Settings screen. It allows a user to enter the Firebase Web configuration (stored only in that browser), sign in, inspect cloud counts, and explicitly import the current local snapshot only when the cloud account is empty.

The panel does NOT automatically write local changes to Firestore and does NOT apply cloud snapshots to localStorage. This is intentional: bidirectional sync is not enabled until deletion propagation, conflict resolution, offline/reconnect, and restore-backup behavior have been implemented and tested. The app's existing local workflows remain the source of truth at this stage. No Firebase rules are deployed by this repository commit.
