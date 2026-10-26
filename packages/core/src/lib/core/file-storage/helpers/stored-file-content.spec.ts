import { Readable } from 'node:stream';
import {
	FileContentTooLargeError,
	fileContentToBuffer,
	MAX_BUFFERED_FILE_BYTES,
	readStorageFileAsBuffer,
	StorageFileReadError
} from './stored-file-content';

/**
 * What the S3, Wasabi and DigitalOcean providers' `getFile` resolves: the AWS SDK v3 `GetObjectCommandOutput.Body`,
 * a Node stream with the SDK's `transformTo*` methods mixed in (`sdkStreamMixin`) — not a Buffer.
 */
function sdkBody(...chunks: Buffer[]): Readable & { transformToByteArray: jest.Mock } {
	const stream = Readable.from(chunks);
	return Object.assign(stream, {
		transformToByteArray: jest.fn(async () => new Uint8Array(Buffer.concat(chunks))),
		transformToString: jest.fn(async () => Buffer.concat(chunks).toString()),
		transformToWebStream: jest.fn()
	});
}

/** A provider stub whose `getFile` resolves (or rejects with) the given content. */
function providerReturning(content: unknown) {
	return { getFile: jest.fn(async (_key: string) => content) };
}

describe('fileContentToBuffer', () => {
	it.each([
		['nothing', undefined, undefined],
		['null', null, undefined],
		['a Buffer', Buffer.from('abc'), 'abc'],
		['a Uint8Array', new Uint8Array([97, 98, 99]), 'abc'],
		['a string', 'abc', 'abc'],
		['an object without bytes', { foo: 'bar' }, undefined]
	])('handles %s', async (_label, content, expected) => {
		const buffer = await fileContentToBuffer(content);
		expect(buffer === undefined ? undefined : buffer.toString()).toBe(expected);
	});

	it('reads an SDK body with transformToByteArray', async () => {
		const body = { transformToByteArray: async () => new Uint8Array([97, 98, 99]) };
		expect((await fileContentToBuffer(body))?.toString()).toBe('abc');
	});

	it('reads a stream to the end', async () => {
		const stream = Readable.from([Buffer.from('ab'), Buffer.from('c')]);
		expect((await fileContentToBuffer(stream))?.toString()).toBe('abc');
	});

	it('is bounded by default', () => {
		expect(MAX_BUFFERED_FILE_BYTES).toBe(64 * 1024 * 1024);
	});

	it('stops reading a stream that exceeds the bound, holding nothing more', async () => {
		let served = 0;
		async function* chunks() {
			for (;;) {
				served += 1;
				yield Buffer.alloc(1024);
			}
		}
		await expect(fileContentToBuffer(chunks(), 4096)).rejects.toThrow(/larger than the 4096 bytes/);
		expect(served).toBe(5);
	});

	it('reads an SDK body that is also a stream chunk by chunk, so the bound stops the read', async () => {
		async function* chunks() {
			for (;;) yield Buffer.alloc(1024);
		}
		const body = Object.assign(Readable.from(chunks()), { transformToByteArray: jest.fn() });
		await expect(fileContentToBuffer(body, 4096)).rejects.toThrow(/larger than the 4096 bytes/);
		expect(body.transformToByteArray).not.toHaveBeenCalled();
	});

	it('refuses bytes already in memory beyond the bound', async () => {
		await expect(fileContentToBuffer(Buffer.alloc(10), 9)).rejects.toBeInstanceOf(FileContentTooLargeError);
		await expect(fileContentToBuffer(Buffer.alloc(10), 9)).rejects.toThrow(/larger than the 9 bytes/);
		const body = { transformToByteArray: async () => new Uint8Array(10) };
		await expect(fileContentToBuffer(body, 9)).rejects.toThrow(/larger than the 9 bytes/);
	});
});

describe('readStorageFileAsBuffer', () => {
	const pdf = Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n', 'latin1');

	it('reads the SDK v3 body stream the S3-family providers return as a real Buffer', async () => {
		const body = sdkBody(pdf.subarray(0, 5), pdf.subarray(5));
		const provider = providerReturning(body);

		const buffer = await readStorageFileAsBuffer(provider, 'documents/t/o/a.pdf');

		expect(provider.getFile).toHaveBeenCalledWith('documents/t/o/a.pdf');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		// The live failure was `buffer.subarray is not a function` on the stream.
		expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
		expect(buffer.equals(pdf)).toBe(true);
	});

	it.each([
		['a Buffer (local, Cloudinary)', () => Buffer.from(pdf)],
		['a Uint8Array', () => new Uint8Array(pdf)],
		['a plain Node stream', () => Readable.from([pdf])],
		[
			'an SDK body that only offers transformToByteArray',
			() => ({ transformToByteArray: async () => new Uint8Array(pdf) })
		]
	])('reads %s', async (_label, content) => {
		const buffer = await readStorageFileAsBuffer(providerReturning(content()), 'k');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.equals(pdf)).toBe(true);
	});

	it('reads a string as its bytes', async () => {
		expect((await readStorageFileAsBuffer(providerReturning('abc'), 'k')).toString()).toBe('abc');
	});

	it('answers an empty file with an empty Buffer, not an error', async () => {
		const buffer = await readStorageFileAsBuffer(providerReturning(Buffer.alloc(0)), 'k');
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.length).toBe(0);
	});

	it.each([
		['undefined (the S3 family and the local provider swallow their errors)', undefined],
		['null (the debug provider)', null]
	])('throws a clear error when the provider returns %s', async (_label, content) => {
		const read = readStorageFileAsBuffer(providerReturning(content), 'documents/t/o/gone.pdf');
		await expect(read).rejects.toBeInstanceOf(StorageFileReadError);
		await expect(read).rejects.toMatchObject({ key: 'documents/t/o/gone.pdf', reason: 'missing' });
		await expect(read).rejects.toThrow(/documents\/t\/o\/gone\.pdf.*returned nothing/);
	});

	it('throws a clear error when the provider returns something that holds no bytes', async () => {
		await expect(readStorageFileAsBuffer(providerReturning({ foo: 'bar' }), 'k')).rejects.toMatchObject({
			name: 'StorageFileReadError',
			reason: 'unreadable'
		});
	});

	it('wraps a provider that throws, keeping its error as the cause', async () => {
		const failure = Object.assign(new Error('The specified key does not exist.'), { name: 'NoSuchKey' });
		const provider = { getFile: jest.fn(async () => Promise.reject(failure)) };

		const error = await readStorageFileAsBuffer(provider, 'k').catch((caught) => caught);

		expect(error).toBeInstanceOf(StorageFileReadError);
		expect(error).toMatchObject({ reason: 'failed', cause: failure });
		expect(error.message).toMatch(/'k' could not be read: The specified key does not exist\./);
	});

	it('wraps a stream that fails part way', async () => {
		async function* broken() {
			yield Buffer.from('%PDF-');
			throw new Error('socket hang up');
		}
		const error = await readStorageFileAsBuffer(providerReturning(Readable.from(broken())), 'k').catch((e) => e);
		expect(error).toBeInstanceOf(StorageFileReadError);
		expect(error).toMatchObject({ reason: 'failed' });
		expect(error.message).toMatch(/socket hang up/);
	});

	it('refuses a file over the bound with FileContentTooLargeError, and releases the stream it stopped reading', async () => {
		async function* endless() {
			for (;;) yield Buffer.alloc(1024);
		}
		const stream = Readable.from(endless());

		await expect(
			readStorageFileAsBuffer(providerReturning(stream), 'k', { maxBytes: 4096 })
		).rejects.toBeInstanceOf(FileContentTooLargeError);
		// An abandoned SDK body that is never consumed nor destroyed keeps its pooled socket.
		expect(stream.destroyed).toBe(true);
	});

	it('applies the default bound when maxBytes is not a positive number', async () => {
		for (const maxBytes of [Number.NaN, 0, -1, undefined]) {
			await expect(
				readStorageFileAsBuffer(providerReturning(Buffer.from(pdf)), 'k', { maxBytes })
			).resolves.toEqual(pdf);
		}
		await expect(
			readStorageFileAsBuffer(providerReturning(Buffer.alloc(10)), 'k', { maxBytes: Number.NaN })
		).resolves.toHaveLength(10);
		expect(MAX_BUFFERED_FILE_BYTES).toBeGreaterThan(10);
	});
});
