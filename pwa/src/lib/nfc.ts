export interface NfcTagRead {
  tagId: string;
  ndefText?: string;
}

export type NfcAvailability = "supported" | "unsupported";

export type PresenceFeedbackKind = "success" | "error" | "unknown";

const textDecoder = new TextDecoder();

/** Normalise l'identifiant tag (UID sans séparateurs, minuscules). */
export function normalizeTagId(raw: string): string {
  return raw.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
}

export function isNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

export function getNfcAvailability(): NfcAvailability {
  return isNfcSupported() ? "supported" : "unsupported";
}

function decodeNdefText(record: NDEFRecord): string | undefined {
  if (record.recordType !== "text" || !record.data) return undefined;
  try {
    const payload = new Uint8Array(
      record.data.buffer,
      record.data.byteOffset,
      record.data.byteLength,
    );
    const status = payload[0] ?? 0;
    const langLength = status & 0x3f;
    const textBytes = payload.slice(1 + langLength);
    return textDecoder.decode(textBytes).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Extrait l'identifiant badge depuis un événement Web NFC. */
export function extractTagRead(event: NDEFReadingEvent): NfcTagRead {
  const serial = event.serialNumber?.trim();
  let ndefText: string | undefined;

  for (const record of event.message.records) {
    const text = decodeNdefText(record);
    if (text) {
      ndefText = text;
      break;
    }
  }

  const tagId = normalizeTagId(serial || ndefText || "");
  if (!tagId) {
    throw new Error("EMPTY_TAG_ID");
  }

  return { tagId, ndefText };
}

export function playPresenceFeedback(kind: PresenceFeedbackKind): void {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = kind === "success" ? 880 : kind === "unknown" ? 520 : 220;
    gain.gain.value = 0.08;

    const duration = kind === "success" ? 0.1 : 0.18;
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
    window.setTimeout(() => void ctx.close(), Math.ceil(duration * 1000) + 50);
  } catch {
    // Audio non disponible (autoplay policy, etc.)
  }
}

export interface NfcReaderCallbacks {
  onRead: (tag: NfcTagRead) => void;
  onError?: (error: Error) => void;
}

/** Session de lecture NFC continue (relance après chaque tag). */
export class NfcReaderSession {
  private abortController: AbortController | null = null;
  private reader: NDEFReader | null = null;
  private running = false;
  private callbacks: NfcReaderCallbacks | null = null;

  get active(): boolean {
    return this.running;
  }

  async start(callbacks: NfcReaderCallbacks): Promise<void> {
    if (!isNfcSupported()) {
      throw new Error("NFC_UNSUPPORTED");
    }
    if (this.running) return;

    this.callbacks = callbacks;
    this.running = true;
    this.abortController = new AbortController();

    const reader = new NDEFReader();
    this.reader = reader;
    const signal = this.abortController.signal;

    reader.addEventListener("reading", this.handleReading);
    reader.addEventListener("readingerror", this.handleReadingError);

    try {
      await reader.scan({ signal });
    } catch (err) {
      if (signal.aborted) return;
      const error = err instanceof Error ? err : new Error("NFC_SCAN_FAILED");
      if (error.name === "NotAllowedError") {
        error.message = "NFC_PERMISSION_DENIED";
      }
      this.callbacks?.onError?.(error);
      this.stop();
    }
  }

  stop(): void {
    this.running = false;
    this.callbacks = null;
    this.abortController?.abort();
    this.abortController = null;
    if (this.reader) {
      this.reader.removeEventListener("reading", this.handleReading);
      this.reader.removeEventListener("readingerror", this.handleReadingError);
      this.reader = null;
    }
  }

  private handleReading = (event: Event): void => {
    try {
      const tag = extractTagRead(event as NDEFReadingEvent);
      this.callbacks?.onRead(tag);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("NFC_READ_FAILED");
      this.callbacks?.onError?.(error);
    }

    if (this.running && this.reader && this.abortController) {
      void this.reader.scan({ signal: this.abortController.signal }).catch((err) => {
        if (this.abortController?.signal.aborted) return;
        const error = err instanceof Error ? err : new Error("NFC_SCAN_FAILED");
        this.callbacks?.onError?.(error);
      });
    }
  };

  private handleReadingError = (): void => {
    this.callbacks?.onError?.(new Error("NFC_READING_ERROR"));
  };
}
