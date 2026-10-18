/**
 * Typings for the `compression` middleware (the package ships none; `@types/compression` is not a
 * dependency of this workspace). Only what `response-compression.ts` uses.
 */
declare module 'compression' {
	import type { Request, RequestHandler, Response } from 'express';

	namespace compression {
		interface CompressionOptions {
			/** zlib compression level, 0 (none) to 9 (best); the zlib default is 6. */
			level?: number;
			/** Smallest response (bytes) worth compressing. */
			threshold?: number | string;
			/** Decides per response; `compression.filter` is the default (compressible content types). */
			filter?: (req: Request, res: Response) => boolean;
			/** Brotli options; quality defaults to 4 in the middleware. */
			brotli?: Record<string, unknown>;
		}

		/** The default filter: compressible content types (per mime-db) not marked `Cache-Control: no-transform`. */
		function filter(req: Request, res: Response): boolean;
	}

	function compression(options?: compression.CompressionOptions): RequestHandler;

	export = compression;
}
