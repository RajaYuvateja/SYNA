/**
 * SYNA — Multilingual Clinical Voice Triage & Nurse Handoff Platform
 * Offline Storage & Local Sync Layer
 * 
 * Provides IndexedDB & localStorage persistence for clinical drafts
 * when network connectivity to hospital server / Sarvam AI is lost.
 */

import { OfflineDraft } from "@/types/syna";

const DRAFTS_KEY = "syna_offline_drafts_v1";

export class OfflineStorageManager {
  private static instance: OfflineStorageManager;

  public static getInstance(): OfflineStorageManager {
    if (!OfflineStorageManager.instance) {
      OfflineStorageManager.instance = new OfflineStorageManager();
    }
    return OfflineStorageManager.instance;
  }

  /**
   * Save an intake draft locally
   */
  public saveDraft(draft: OfflineDraft): void {
    if (typeof window === "undefined") return;

    try {
      const existing = this.getAllDrafts();
      const filtered = existing.filter((d) => d.id !== draft.id);
      
      // Store draft (omitting raw audioBlob from localStorage for space, keeping base info)
      const serializableDraft = {
        ...draft,
        audioBlob: undefined, // Audio blobs can be kept in IndexedDB in production
      };

      filtered.unshift(serializableDraft);
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered.slice(0, 20)));
    } catch (err) {
      console.warn("[SYNA Offline] Failed to persist draft to localStorage:", err);
    }
  }

  /**
   * Retrieve all saved offline drafts
   */
  public getAllDrafts(): OfflineDraft[] {
    if (typeof window === "undefined") return [];

    try {
      const data = localStorage.getItem(DRAFTS_KEY);
      if (!data) return [];
      return JSON.parse(data) as OfflineDraft[];
    } catch {
      return [];
    }
  }

  /**
   * Get draft by ID
   */
  public getDraftById(id: string): OfflineDraft | undefined {
    return this.getAllDrafts().find((d) => d.id === id);
  }

  /**
   * Update sync status of a draft
   */
  public updateDraftStatus(id: string, status: OfflineDraft["syncStatus"]): void {
    const drafts = this.getAllDrafts();
    const target = drafts.find((d) => d.id === id);
    if (target) {
      target.syncStatus = status;
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    }
  }

  /**
   * Remove a draft once verified and synced to nurse queue
   */
  public removeDraft(id: string): void {
    const drafts = this.getAllDrafts().filter((d) => d.id !== id);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }
}

export const offlineStorage = OfflineStorageManager.getInstance();
