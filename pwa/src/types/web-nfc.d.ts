interface NDEFMessageInit {
  records?: NDEFRecordInit[];
}

interface NDEFRecordInit {
  recordType?: string;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: BufferSource | string;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFMessage {
  records: ReadonlyArray<NDEFRecord>;
}

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
  toRecords?: () => NDEFRecord[];
}

interface NDEFReaderScanOptions {
  signal?: AbortSignal;
}

declare class NDEFReader extends EventTarget {
  scan(options?: NDEFReaderScanOptions): Promise<void>;
  write(message: NDEFMessageInit, options?: NDEFReaderScanOptions): Promise<void>;
  makeReadOnly(options?: NDEFReaderScanOptions): Promise<void>;
  addEventListener(
    type: "reading",
    listener: (this: NDEFReader, ev: NDEFReadingEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: "readingerror",
    listener: (this: NDEFReader, ev: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

interface Window {
  NDEFReader: typeof NDEFReader;
}
