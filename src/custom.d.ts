import { Request } from "express";

// This extends the standard Express Request to include Multer's 'file' property
declare global {
  namespace Express {
    namespace Multer {
      interface File {
        location: string;
        key: string;
        bucket: string;
        etag: string;
      }
    }
  }
}

// This fixes the "Property 'file' does not exist" error
declare module "express-serve-static-core" {
  interface Request {
    file?: Express.Multer.File;
  }
}
