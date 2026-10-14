import { ClientRequest, IncomingMessage, request as httpRequest, RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { pinnedWebhookLookup } from './webhook-endpoint-policy';

/**
 * One POST a webhook attempt makes.
 */
export interface IWebhookTransportRequest {
	/** The headers to send, exactly as built; `Content-Length` is added from the body. */
	readonly headers: Record<string, string>;
	/** The exact bytes that were signed. */
	readonly body: string;
	/** How long the attempt may take, from resolving the host to the last byte read. */
	readonly timeoutMs: number;
	/** How many bytes of the response body are read before the connection is closed. */
	readonly bodyLimit: number;
}

/**
 * What the endpoint answered.
 */
export interface IWebhookTransportAnswer {
	/** The HTTP status. */
	readonly status: number;
	/** True for a 2xx status. */
	readonly ok: boolean;
	/** At most `bodyLimit` bytes of the response body, decoded as UTF-8. */
	readonly body: string;
	/** True when the body was longer than the limit and the connection was closed early. */
	readonly truncated: boolean;
}

/**
 * The HTTP client of the webhook delivery path.
 *
 * The platform's `fetch` was the client, and two of its defaults are wrong for a request a tenant points
 * anywhere it likes:
 *
 * - **It resolves the host itself.** The policy checked one DNS answer and `fetch` connected to another,
 *   which is the rebinding window (R1-04 / R7-07). Here the socket resolves through
 *   {@link pinnedWebhookLookup}, so the address the policy decides on is the address connected to.
 * - **`response.text()` reads the whole body.** A receiver that streams for the whole timeout made the
 *   process buffer all of it before four kilobytes were kept (R1-05 / R7-08) — one tenant's endpoint could
 *   take down every tenant served by the pod. Here the body is read chunk by chunk up to the limit, and the
 *   connection is closed the moment the limit is reached.
 *
 * Nothing else changes: a redirect is never followed (Node's client does not follow one), the timeout bounds
 * the attempt from the lookup to the last byte, a certificate is verified against the host name, and no
 * connection is reused between attempts. A timeout fails with an `AbortError`, as `fetch` did, so the
 * delivery path tells a slow receiver from a broken one the same way.
 */
export class WebhookTransport {
	/**
	 * Posts one attempt.
	 *
	 * @param url The endpoint.
	 * @param request The headers, the body and the limits.
	 * @returns What the endpoint answered.
	 * @throws WebhookEndpointRefusedError when the host resolves into a refused range at connect time.
	 * @throws Error (`AbortError`) when the attempt outlives its timeout, or the transport error itself.
	 */
	post(url: string | URL, request: IWebhookTransportRequest): Promise<IWebhookTransportAnswer> {
		const target = typeof url === 'string' ? new URL(url) : url;

		if (target.protocol !== 'https:' && target.protocol !== 'http:') {
			return Promise.reject(new Error(`A webhook endpoint must be an HTTP(S) URL, not "${target.protocol}".`));
		}

		const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
		const options: RequestOptions = {
			method: 'POST',
			headers: { ...request.headers, 'Content-Length': String(Buffer.byteLength(request.body)) },
			lookup: pinnedWebhookLookup as RequestOptions['lookup'],
			// A connection of its own per attempt: nothing pooled can carry an address resolved for another.
			agent: false
		};

		return new Promise<IWebhookTransportAnswer>((resolve, reject) => {
			let settled = false;
			let timer: NodeJS.Timeout | undefined;
			let outgoing: ClientRequest | undefined;

			const settle = (finish: () => void): void => {
				if (settled) {
					return;
				}

				settled = true;
				clearTimeout(timer);
				finish();
			};

			const onResponse = (response: IncomingMessage): void => {
				const chunks: Buffer[] = [];
				let size = 0;
				const status = response.statusCode ?? 0;
				const answer = (truncated: boolean): IWebhookTransportAnswer => ({
					status,
					ok: status >= 200 && status < 300,
					body: Buffer.concat(chunks).toString('utf8'),
					truncated
				});

				response.on('data', (chunk: Buffer) => {
					if (settled) {
						return;
					}

					const room = request.bodyLimit - size;

					if (chunk.length > room) {
						// The limit is reached: keep what fits and hang up, rather than read the rest only
						// to drop it.
						chunks.push(chunk.subarray(0, room));
						size += room;
						settle(() => resolve(answer(true)));
						response.destroy();
						outgoing?.destroy();
						return;
					}

					chunks.push(chunk);
					size += chunk.length;
				});
				response.on('end', () => settle(() => resolve(answer(false))));
				response.on('error', (error) => settle(() => reject(error)));
				response.on('close', () => {
					if (!response.complete) {
						settle(() => reject(new Error('The endpoint closed the connection before the response was complete.')));
					}
				});
			};

			try {
				outgoing = send(target, options, onResponse);
			} catch (error) {
				// An invalid header value is refused synchronously, before any connection exists.
				reject(error);
				return;
			}

			timer = setTimeout(() => {
				const error = new Error(`The endpoint did not respond within ${request.timeoutMs} ms.`);
				error.name = 'AbortError';
				settle(() => reject(error));
				outgoing?.destroy();
			}, request.timeoutMs);

			outgoing.on('error', (error) => settle(() => reject(error)));
			outgoing.end(request.body);
		});
	}
}
