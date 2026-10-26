import type { Readable } from 'node:stream';

/*
 * Reading a stored file back as bytes.
 *
 * A provider's `getFile` does NOT always resolve a Buffer, whatever its old signature said: the local and Cloudinary
 * providers resolve one, but the S3, Wasabi and DigitalOcean providers resolve the AWS SDK v3
 * `GetObjectCommandOutput.Body`, a Node stream (with `transformToByteArray()`), and every provider resolves `undefined`
 * or `null` when the file could not be read (the S3 family and the local provider log the error and swallow it; the
 * debug provider stores nothing). Code that cast the result to a Buffer worked on a local install and broke on every
 * S3-compatible deployment: `buffer.subarray is not a function`. Read stored bytes through
 * {@link readStorageFileAsBuffer}, or {@link fileContentToBuffer} for content already fetched.
 */

/**
 * What a file storage provider's `getFile` resolves to: a Buffer (local, Cloudinary), the AWS SDK v3 body stream (S3,
 * Wasabi, DigitalOcean), or nothing when the file could not be read.
 */
export type StoredFileContent =
	| Buffer
	| Uint8Array
	| string
	| Readable
	| AsyncIterable<Buffer | Uint8Array | string>
	| { transformToByteArray(): Promise<Uint8Array> }
	| null
	| undefined;

/**
 * The most bytes {@link fileContentToBuffer} buffers from a provider: an upload bigger than this (the upload
 * endpoints set no multer size limit) is refused rather than held in memory chunk by chunk.
 */
export const MAX_BUFFERED_FILE_BYTES = 64 * 1024 * 1024;

/**
 * Thrown by {@link fileContentToBuffer} when the stored file is larger than it may buffer. The upload endpoints set no
 * multer size limit, so the file is already stored when this is thrown: the caller deletes it (it would otherwise
 * stay served from `/public/` with no record to delete it through) and answers 413.
 */
export class FileContentTooLargeError extends Error {
	constructor(readonly maxBytes: number) {
		super(`The file is larger than the ${maxBytes} bytes that can be processed`);
		this.name = 'FileContentTooLargeError';
	}
}

/**
 * The stored file's bytes as a Buffer. The local provider returns a Buffer; the S3, Wasabi and DigitalOcean
 * providers return the SDK's stream (`GetObjectCommandOutput.Body`). `undefined` when the provider returned nothing.
 *
 * @param content What the file storage provider's `getFile` returned.
 * @param maxBytes The most bytes accepted; beyond it the content is refused (a stream is left unread).
 * @returns The bytes, or `undefined`.
 * @throws When the content exceeds `maxBytes`.
 */
export async function fileContentToBuffer(
	content: unknown,
	maxBytes: number = MAX_BUFFERED_FILE_BYTES
): Promise<Buffer | undefined> {
	const bounded = (buffer: Buffer): Buffer => {
		if (buffer.length > maxBytes) {
			throw new FileContentTooLargeError(maxBytes);
		}
		return buffer;
	};
	if (content === null || content === undefined) return undefined;
	if (Buffer.isBuffer(content)) return bounded(content);
	if (content instanceof Uint8Array) return bounded(Buffer.from(content));
	if (typeof content === 'string') return bounded(Buffer.from(content));
	// An S3-family SDK body is a Readable AND has transformToByteArray(): read it chunk by chunk first, so the
	// bound stops the read rather than being checked once the whole object is in memory.
	if (typeof (content as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
		const chunks: Buffer[] = [];
		let length = 0;
		for await (const chunk of content as AsyncIterable<Buffer | Uint8Array | string>) {
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
			length += buffer.length;
			if (length > maxBytes) {
				// Stop reading: nothing more is held, and the stream is left to its owner.
				throw new FileContentTooLargeError(maxBytes);
			}
			chunks.push(buffer);
		}
		return Buffer.concat(chunks, length);
	}
	const body = content as { transformToByteArray?: () => Promise<Uint8Array> };
	if (typeof body.transformToByteArray === 'function') return bounded(Buffer.from(await body.transformToByteArray()));
	return undefined;
}

/** Why a stored file could not be read back. */
export type StorageFileReadFailure = 'missing' | 'unreadable' | 'failed';

/**
 * Thrown by {@link readStorageFileAsBuffer} when the stored file could not be read as bytes: the provider returned
 * nothing (`missing` — the object does not exist, or the provider swallowed the error and logged it), returned
 * something that holds no bytes (`unreadable`), or threw while fetching or streaming it (`failed`, the provider's
 * error as `cause`). Callers map it to their own answer (404 for a download, a rejection for an upload, a retry for a
 * queued job); it is never a `TypeError` from treating a stream or `undefined` as a Buffer.
 */
export class StorageFileReadError extends Error {
	constructor(
		readonly key: string,
		readonly reason: StorageFileReadFailure,
		options?: { cause?: unknown }
	) {
		super(StorageFileReadError.describe(key, reason, options?.cause));
		this.name = 'StorageFileReadError';
		if (options && 'cause' in options) {
			(this as { cause?: unknown }).cause = options.cause;
		}
	}

	private static describe(key: string, reason: StorageFileReadFailure, cause: unknown): string {
		const what = `The stored file '${key}'`;
		switch (reason) {
			case 'missing':
				return `${what} could not be read: the storage provider returned nothing`;
			case 'unreadable':
				return `${what} could not be read: the storage provider returned no bytes`;
			default: {
				const detail = cause instanceof Error ? cause.message : cause === undefined ? '' : String(cause);
				return `${what} could not be read${detail ? `: ${detail}` : ''}`;
			}
		}
	}
}

export interface ReadStorageFileOptions {
	/**
	 * The most bytes read; a larger file throws {@link FileContentTooLargeError} (a stream is read chunk by chunk and
	 * abandoned at the bound, never held whole). Default {@link MAX_BUFFERED_FILE_BYTES}; a value that is not a
	 * positive number also falls back to it.
	 */
	maxBytes?: number;
}

/**
 * Reads a stored file's bytes through its provider, whatever form the provider answers in (a Buffer, a Uint8Array,
 * a string, an AWS SDK v3 body stream or any Node stream).
 *
 * @param provider The file storage provider the file is stored with (anything with `getFile`).
 * @param key The file's storage key.
 * @param options The read bound.
 * @returns The bytes. An empty file is an empty Buffer, never an error.
 * @throws StorageFileReadError when the file could not be read (see {@link StorageFileReadFailure}).
 * @throws FileContentTooLargeError when the file is larger than `maxBytes`.
 */
export async function readStorageFileAsBuffer(
	provider: { getFile(key: string): Promise<unknown> },
	key: string,
	options: ReadStorageFileOptions = {}
): Promise<Buffer> {
	const maxBytes =
		typeof options.maxBytes === 'number' && Number.isFinite(options.maxBytes) && options.maxBytes > 0
			? options.maxBytes
			: MAX_BUFFERED_FILE_BYTES;

	let content: unknown;
	try {
		content = await provider.getFile(key);
	} catch (error) {
		throw new StorageFileReadError(key, 'failed', { cause: error });
	}
	if (content === undefined || content === null) {
		throw new StorageFileReadError(key, 'missing');
	}

	let buffer: Buffer | undefined;
	try {
		buffer = await fileContentToBuffer(content, maxBytes);
	} catch (error) {
		if (error instanceof FileContentTooLargeError) {
			throw error;
		}
		// The stream failed part way (a reset connection, an aborted body).
		throw new StorageFileReadError(key, 'failed', { cause: error });
	}
	if (!buffer) {
		throw new StorageFileReadError(key, 'unreadable');
	}
	return buffer;
}
