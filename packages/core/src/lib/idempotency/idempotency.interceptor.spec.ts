/**
 * What a retry under a failed key is answered with.
 *
 * The kernel's promise is that a key whose request was refused replays *the refusal* — and the audit
 * that produced this suite found it replaying the status alone. A client that retries a `428` and is
 * handed a bodyless `428` cannot tell which precondition it missed, which idempotency key was reused or
 * what the payer refusal said, so the code it switches on is gone exactly when it is needed. The record
 * therefore keeps the body the caller saw, and this suite drives the real interceptor twice over an
 * in-memory store to pin both halves: the write, and the replay.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { ApiException } from '../core/errors/api-exception';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { IDEMPOTENT_METADATA_KEY } from './idempotency.policy';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const SCOPE = 'subscription.bill';
const KEY = 'probe-key-12345678';

/** The store, in memory, keyed the way the kernel keys a row. */
function keyStore() {
	const rows = new Map<string, any>();
	let sequence = 0;

	return {
		rows,
		claim: jest.fn(async (input: any) => {
			const existing = rows.get(`${input.scope}:${input.key}`);

			if (existing) {
				return {
					outcome: 'REPLAYED',
					record: existing,
					response: { status: existing.responseStatus, body: existing.responseBody }
				};
			}

			const record = { id: `key-${++sequence}`, ...input, status: 'IN_PROGRESS' };
			rows.set(`${input.scope}:${input.key}`, record);

			return { outcome: 'CLAIMED', record };
		}),
		complete: jest.fn(async (id: string, completion: any) => {
			for (const row of rows.values()) {
				if (row.id === id) {
					Object.assign(row, completion, { status: 'COMPLETED' });
				}
			}

			return undefined;
		}),
		fail: jest.fn(async (id: string, completion: any) => {
			for (const row of rows.values()) {
				if (row.id === id) {
					Object.assign(row, completion, { status: 'FAILED' });
				}
			}

			return undefined;
		})
	};
}

/** One HTTP request through the interceptor. */
function request(key?: string) {
	return {
		method: 'POST',
		originalUrl: '/api/subscriptions/sub-1/bill',
		params: { id: 'sub-1' },
		query: {},
		body: {},
		headers: key === undefined ? {} : { 'idempotency-key': key }
	};
}

/**
 * The surface: one route, whose handler is whatever the case needs.
 *
 * The metadata is written by hand because the suite drives the interceptor directly rather than through
 * a controller — what the decorator records is what the interceptor reads, and the policy suite already
 * pins the decorator itself.
 */
function surface(handler: () => Promise<unknown>) {
	const store = keyStore();
	const interceptor = new IdempotencyInterceptor(store as never, new Reflector());
	const prototype = { bill: handler };
	const response = {
		statusCode: 0,
		status(code: number) {
			this.statusCode = code;

			return this;
		},
		setHeader: () => undefined
	};

	Reflect.defineMetadata(IDEMPOTENT_METADATA_KEY, { scope: SCOPE, required: false }, prototype.bill);

	const send = async (input: ReturnType<typeof request>) => {
		const context = {
			getType: () => 'http',
			getClass: () => class Controller {},
			getHandler: () => prototype.bill,
			switchToHttp: () => ({ getRequest: () => input, getResponse: () => response })
		} as never;

		try {
			// `from(...)` rather than a hand-written observable: `lastValueFrom` is what the interceptor
			// uses, and a double that is not an Observable escapes as an unhandled rejection instead of
			// reaching the assertion.
			const body = await lastValueFrom(
				interceptor.intercept(context, { handle: () => from(handler()) } as never) as never
			);

			return { status: response.statusCode, body, thrown: false };
		} catch (error) {
			return { status: response.statusCode, body: error, thrown: true };
		}
	};

	return { send, store, response };
}

describe('a key whose request was refused', () => {
	it('records the refusal body, not only its status', async () => {
		const refused = new ApiException(
			HttpStatus.PRECONDITION_REQUIRED,
			ApiErrorCode.VERSION_REQUIRED,
			'This write must state the version it was based on.'
		);
		const { send, store } = surface(async () => {
			throw refused;
		});

		await send(request(KEY));

		// Control: the row this pins is the one a client's retry reads. Recording the status alone left
		// every replay bodyless, so a caller could not tell a missing precondition from a payer refusal.
		const row = [...store.rows.values()][0];

		expect(row.status).toBe('FAILED');
		expect(row.responseStatus).toBe(HttpStatus.PRECONDITION_REQUIRED);
		expect(row.responseBody).toMatchObject({ code: ApiErrorCode.VERSION_REQUIRED });
		expect(String(row.responseBody.message)).toContain('state the version');
	});

	it('replays that body at that status when the caller retries', async () => {
		let attempts = 0;
		const { send } = surface(async () => {
			attempts += 1;

			throw new HttpException({ message: 'The payer was refused.', code: 'SUBSCRIPTION_PAYER_MISSING' }, 409);
		});

		await send(request(KEY));
		const retry = await send(request(KEY));

		// The retry ran no work — the whole point of the key — and what it answers is the first attempt's
		// own refusal: the stored status, and a body a client can branch on. The interceptor answers a
		// replay by setting the status and returning the stored body, which is how a success is replayed
		// too, so the retry is not an exception here — it is the same response the first caller received.
		expect(attempts).toBe(1);
		expect(retry.status).toBe(409);
		expect(retry.body).toMatchObject({ code: 'SUBSCRIPTION_PAYER_MISSING' });
		expect(String((retry.body as Record<string, unknown>).message)).toContain('payer was refused');
	});

	it('keeps the status alone when the thrown value carries no body', async () => {
		const { send, store } = surface(async () => {
			throw new Error('connection terminated unexpectedly');
		});

		await send(request(KEY));

		const row = [...store.rows.values()][0];

		// A non-HTTP failure has no body of its own — the filter builds one — so nothing is invented here.
		expect(row.responseStatus).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(row.responseBody).toBeUndefined();
	});
});
