import { Injectable, NestMiddleware, PayloadTooLargeException } from '@nestjs/common';
import { getInboxEmailConfig } from './inbox-email.config';

/**
 * Bodies the API's own parsers (JSON, URL-encoded form) leave unread that a provider webhook sends: a form with files
 * (Mailgun routes, SendGrid Inbound Parse) and SNS's `text/plain` JSON (Amazon SES).
 */
const RAW_TYPES = /^\s*(multipart\/form-data|text\/plain)\b/i;
const MAX_LIMIT = 100 * 1024 * 1024;

/** The request fields the middleware reads (Node's request, without depending on Express's types). */
interface RawCapableRequest {
	headers?: Record<string, string | string[] | undefined>;
	rawBody?: Buffer;
	readableEnded?: boolean;
	on(event: 'data', listener: (chunk: Buffer) => void): unknown;
	on(event: 'end', listener: () => void): unknown;
	on(event: 'error', listener: (error: Error) => void): unknown;
}

/** The most bytes a raw webhook body may have: room for a message at the size cap in two forms (text and MIME). */
export function inboundRawBodyLimit(): number {
	return Math.min(MAX_LIMIT, getInboxEmailConfig().maxMessageBytes * 2 + 1024 * 1024);
}

/**
 * On the provider webhook route only: reads a `multipart/form-data` or `text/plain` body into `request.rawBody` (the
 * bytes a provider signs), up to {@link inboundRawBodyLimit} (413 beyond it). Anything else — a JSON or form body the
 * API already parsed, with its raw bytes — passes untouched.
 */
@Injectable()
export class InboundRawBodyMiddleware implements NestMiddleware {
	use(request: RawCapableRequest, _response: unknown, next: (error?: unknown) => void): void {
		const header = request.headers?.['content-type'];
		const type = (Array.isArray(header) ? header[0] : header) ?? '';
		if (request.rawBody || request.readableEnded || !RAW_TYPES.test(type)) {
			next();
			return;
		}
		const limit = inboundRawBodyLimit();
		const chunks: Buffer[] = [];
		let size = 0;
		let done = false;
		const finish = (error?: unknown) => {
			if (done) return;
			done = true;
			next(error);
		};
		request.on('data', (chunk: Buffer) => {
			if (done) return;
			size += chunk.length;
			if (size > limit) {
				// The rest is drained (and ignored) so the 413 reaches the sender.
				finish(new PayloadTooLargeException(`A webhook body is at most ${limit} bytes.`));
				return;
			}
			chunks.push(chunk);
		});
		request.on('end', () => {
			if (done) return;
			request.rawBody = Buffer.concat(chunks);
			finish();
		});
		request.on('error', (error) => finish(error));
	}
}
