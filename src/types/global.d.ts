declare module "multer" {
  import { Request } from "express";

  namespace multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Buffer;
    }

    type FileFilterCallback = (
      error: Error | null,
      acceptFile: boolean
    ) => void;
  }

  function multer(options?: multer.Options): multer.Multer;

  namespace multer {
    interface Options {
      dest?: string;
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
      fileFilter?(req: Request, file: File, callback: FileFilterCallback): void;
    }

    interface StorageEngine {
      _handleFile(
        req: Request,
        file: File,
        callback: (error?: any, info?: Partial<File>) => void
      ): void;
      _removeFile(
        req: Request,
        file: File,
        callback: (error: Error) => void
      ): void;
    }

    interface Multer {
      single(fieldname: string): any;
      array(fieldname: string, maxCount?: number): any;
      fields(fields: Array<{ name: string; maxCount?: number }>): any;
      none(): any;
      any(): any;
    }

    const diskStorage: (options: {
      destination?:
        | string
        | ((
            req: Request,
            file: File,
            callback: (error: Error | null, destination: string) => void
          ) => void);
      filename?(
        req: Request,
        file: File,
        callback: (error: Error | null, filename: string) => void
      ): void;
    }) => StorageEngine;

    const memoryStorage: () => StorageEngine;
  }

  export = multer;
}
