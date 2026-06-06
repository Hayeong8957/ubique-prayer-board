declare module "formidable" {
  export interface File {
    filepath: string;
    mimetype?: string | null;
    originalFilename?: string | null;
  }

  export interface Files {
    file?: File | File[];
    [key: string]: File | File[] | undefined;
  }

  export interface Options {
    multiples?: boolean;
    maxFiles?: number;
    maxFileSize?: number;
    allowEmptyFiles?: boolean;
  }

  export interface FormidableInstance {
    parse(
      req: unknown,
      callback: (error: Error | null, fields: Record<string, unknown>, files: Files) => void
    ): void;
  }

  export default function formidable(options?: Options): FormidableInstance;
}
