// archiver 8 ne publie pas ses types et n'a plus d'export par défaut : on décrit ici la partie utilisée.
declare module "archiver" {
  import type { Readable, Transform } from "node:stream";

  export interface ZipArchiveOptions {
    zlib?: { level?: number };
  }

  export class ZipArchive extends Transform {
    constructor(options?: ZipArchiveOptions);
    append(source: Readable | Buffer | string, data: { name: string }): this;
    finalize(): Promise<void>;
    pointer(): number;
  }
}
