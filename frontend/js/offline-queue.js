/**
 * IndexedDB Offline Queue & Background Sync Manager
 * Supports rural health kiosks and disconnected ambulance in-transit recording.
 */

const DB_NAME = "ClinicalTriageOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "pending_intakes";

function openTriageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("synced", "synced", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueOfflineIntake(intake) {
  const db = await openTriageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const item = {
      id: intake.id || ("offline_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6)),
      timestamp: Date.now(),
      language: intake.language || "en",
      source: intake.source || "patient",
      text: intake.text || "",
      audio_b64: intake.audio_b64 || null,
      telemetry: intake.telemetry || null,
      eta_minutes: intake.eta_minutes || null,
      local_assessment: intake.local_assessment || null,
      synced: 0
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

async function getUnsyncedIntakes() {
  const db = await openTriageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(i => !i.synced);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function markIntakeSynced(id) {
  const db = await openTriageDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        const item = getReq.result;
        item.synced = 1;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function syncPendingIntakesToServer() {
  if (!navigator.onLine) return 0;
  const unsynced = await getUnsyncedIntakes();
  if (unsynced.length === 0) return 0;

  let count = 0;
  for (const item of unsynced) {
    try {
      // 1. Create server session
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: item.source,
          language: item.language,
          channel: "offline_sync",
          eta_minutes: item.eta_minutes,
          telemetry: item.telemetry
        })
      });
      if (!createRes.ok) continue;
      const { id: serverSessionId } = await createRes.json();

      // 2. Submit utterance
      const utterRes = await fetch(`/api/sessions/${serverSessionId}/utterance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.text || null,
          audio_b64: item.audio_b64 || null,
          asr_confidence: 0.9
        })
      });

      if (utterRes.ok) {
        await markIntakeSynced(item.id);
        count++;
      }
    } catch (err) {
      console.warn("Background sync failed for item:", item.id, err);
    }
  }

  if (count > 0 && typeof showToast === "function") {
    showToast(`📡 Reconnected! Synchronized ${count} offline intakes to hospital server.`, "success");
  }
  return count;
}

// Auto-sync on network reconnect
window.addEventListener("online", () => {
  console.log("[Offline Queue] Internet connection detected. Syncing...");
  syncPendingIntakesToServer();
});

// Periodic background check every 30s
setInterval(() => {
  if (navigator.onLine) syncPendingIntakesToServer();
}, 30000);

if (typeof window !== "undefined") {
  window.OfflineQueue = {
    enqueue: enqueueOfflineIntake,
    getUnsynced: getUnsyncedIntakes,
    sync: syncPendingIntakesToServer
  };
}
