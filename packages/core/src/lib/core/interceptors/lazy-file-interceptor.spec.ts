import { CallHandler, ExecutionContext } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { of } from 'rxjs';
import { Readable } from 'stream';
import { LazyFileInterceptor } from './lazy-file-interceptor';

/**
 * The interceptor is thin, but each thing it does has already failed in production, and the failure
 * was invisible every time:
 *
 *  - a route that omitted `storage` answered 500 on every upload, because `localOptions.storage()`
 *    is called unconditionally while the old signature made it optional. That broke the chat's
 *    dictation endpoint completely, and neither the build, the type-checker nor the existing tests
 *    said anything;
 *  - a route that declared `limits` read as capped while accepting uploads of any size, because
 *    only `storage` and `fileFilter` were forwarded to multer.
 *
 * Both are "declared option silently ignored" — the shape that cannot be caught by reading the call
 * site, only by driving a real multipart request through it. So these tests build one.
 */
describe('LazyFileInterceptor', () => {
	const BOUNDARY = 'gauzy-test-boundary';

	/** A real multipart/form-data body — multer parses bytes, so a hand-built object would prove nothing. */
	const multipartBody = (field: string, filename: string, contents: Buffer): Buffer =>
		Buffer.concat([
			Buffer.from(
				`--${BOUNDARY}\r\n` +
					`Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
					`Content-Type: application/octet-stream\r\n\r\n`
			),
			contents,
			Buffer.from(`\r\n--${BOUNDARY}--\r\n`)
		]);

	/**
	 * A minimal Express-shaped request carrying the body as a stream.
	 *
	 * Busboy (multer's parser) reads `headers` and consumes the request as a Readable, so a Readable
	 * with the two headers set is genuinely enough — no HTTP server needed.
	 */
	const requestFor = (body: Buffer): any => {
		const request = new Readable({
			read() {
				this.push(body);
				this.push(null);
			}
		}) as any;
		request.headers = {
			'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
			'content-length': String(body.length)
		};
		return request;
	};

	const contextFor = (request: any): ExecutionContext =>
		({
			switchToHttp: () => ({
				getRequest: () => request,
				getResponse: () => ({})
			})
		} as unknown as ExecutionContext);

	const nextHandler: CallHandler = { handle: () => of('handled') };

	/** Run one upload through the interceptor and hand back the request multer populated. */
	const run = async (options: any, body: Buffer): Promise<any> => {
		const Interceptor = LazyFileInterceptor('file', options);
		const interceptor = new (Interceptor as any)();
		const request = requestFor(body);
		await interceptor.intercept(contextFor(request), nextHandler);
		return request;
	};

	it('populates file.buffer with memoryStorage — what the dictation handler reads', async () => {
		const audio = Buffer.from('fake-webm-bytes');
		const request = await run({ storage: () => memoryStorage() }, multipartBody('file', 'dictation.webm', audio));

		expect(request.file).toBeDefined();
		expect(request.file.buffer).toEqual(audio);
		expect(request.file.originalname).toBe('dictation.webm');
	});

	it('passes the ExecutionContext to the storage factory, so per-request destinations work', async () => {
		// This is the interceptor's entire reason to exist over Nest's own FileInterceptor: the engine
		// is chosen per request (tenant folder, provider, …) rather than once at module load.
		const storage = jest.fn(() => memoryStorage());
		const request = requestFor(multipartBody('file', 'a.bin', Buffer.from('x')));
		const context = contextFor(request);

		const Interceptor = LazyFileInterceptor('file', { storage } as any);
		await new (Interceptor as any)().intercept(context, nextHandler);

		expect(storage).toHaveBeenCalledTimes(1);
		expect(storage).toHaveBeenCalledWith(context);
	});

	it('fails loudly when no storage factory is supplied', async () => {
		// The signature now makes this a compile error, so the cast is deliberate: it stands in for a
		// JS caller, and pins that the failure is at least immediate rather than a corrupted upload.
		await expect(run({} as any, multipartBody('file', 'a.bin', Buffer.from('x')))).rejects.toThrow();
	});

	it('enforces a declared fileSize limit instead of silently ignoring it', async () => {
		// The regression this exists for: `limits` was dropped on the floor, so a route could declare a
		// cap, pass review, and accept anything. The chat endpoint had to re-implement its own size
		// check in the service for exactly this reason.
		const tooBig = Buffer.alloc(2048, 7);

		await expect(
			run({ storage: () => memoryStorage(), limits: { fileSize: 512 } }, multipartBody('file', 'big.bin', tooBig))
		).rejects.toThrow();
	});

	it('accepts a file that fits inside the declared limit', async () => {
		// The other half of the pair — a limit that rejects everything would also pass the test above.
		const small = Buffer.alloc(128, 3);
		const request = await run(
			{ storage: () => memoryStorage(), limits: { fileSize: 512 } },
			multipartBody('file', 'small.bin', small)
		);

		expect(request.file.buffer).toEqual(small);
	});

	it('applies a declared fileFilter', async () => {
		// Already forwarded before this change; covered so that a future refactor of the spread cannot
		// quietly drop it the way `limits` was dropped.
		const filter = (_req: any, _file: any, callback: (error: Error | null, accept: boolean) => void) =>
			callback(new Error('rejected by filter'), false);

		await expect(
			run({ storage: () => memoryStorage(), fileFilter: filter }, multipartBody('file', 'a.bin', Buffer.from('x')))
		).rejects.toThrow();
	});
});
