declare module 'multer' {
  interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }

  interface Options {
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
    preservePath?: boolean;
  }

  interface StorageEngine {
    _handleFile(req: any, file: File, callback: (error?: any, info?: Partial<File>) => void): void;
    _removeFile(req: any, file: File, callback: (error: Error | null) => void): void;
  }

  interface Multer {
    single(fieldname: string): any;
    array(fieldname: string, maxCount?: number): any;
    fields(fields: { name: string; maxCount?: number }[]): any;
    none(): any;
  }

  function multer(options?: Options): Multer;
  namespace multer {
    function memoryStorage(): StorageEngine;
    function diskStorage(options: {
      destination?: string | ((req: any, file: File, cb: (error: Error | null, destination: string) => void) => void);
      filename?: (req: any, file: File, cb: (error: Error | null, filename: string) => void) => void;
    }): StorageEngine;
  }

  export = multer;
}
