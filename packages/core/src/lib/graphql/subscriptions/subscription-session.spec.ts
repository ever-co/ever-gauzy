import { AsyncLocalStorage } from 'async_hooks';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { buildSchema } from 'graphql';
import { GRAPHQL_TRANSPORT_WS_PROTOCOL, makeServer } from 'graphql-ws';
import { sign } from 'jsonwebtoken';
import { ClsService } from 'nestjs-cls';
import * as passport from 'passport';
import { ExtractJwt, Strategy as PassportJwtStrategy } from 'passport-jwt';
import { RequestContext } from '../../core/context/request-context';
import { createGraphqlRequestContext } from '../graphql-context';
import { GraphqlTopicBroker } from './graphql-pubsub.service';
import { SubscriptionClock } from './subscription-delivery';
import {
	DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS,
	MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS,
	MIN_SUBSCRIPTION_REAUTH_INTERVAL_MS,
	SUBSCRIPTION_REAUTH_RETRY_MS,
	SUBSCRIPTION_REAUTH_TIMEOUT_MS,
	SUBSCRIPTION_SESSION_CLOSE,
	SubscriptionCredentialVerdict,
	SubscriptionSession,
	SubscriptionSessionUser,
	bearerTokenExpiry,
	bearerTokenOf,
	resolveSubscriptionReauthIntervalMs,
	sameSubscriptionAuthorization
} from './subscription-session';
import {
	authenticateSubscriptionCredential,
	createSubscriptionServerOptions,
	graphqlContextArguments
} from './subscription-transport';

/**
 * A subscription socket used to be authenticated once, when an operation opened: a stream kept delivering
 * after its access token expired and after its user was deactivated. These cases pin the session that holds
 * a socket to its credential for as long as it is open — on its own, through `graphql-ws` itself, and the
 * default judgement against a real passport `jwt` strategy.
 */

/** A clock the spec moves by hand; a timer runs when the clock passes it. */
class ManualClock implements SubscriptionClock {
	private current = Date.UTC(2026, 9, 24, 12, 0, 0);
	private readonly timers: Array<{ at: number; run: () => void; cancelled: boolean }> = [];

	now(): number {
		return this.current;
	}

	schedule(run: () => void, delayMs: number): () => void {
		const timer = { at: this.current + delayMs, run, cancelled: false };
		this.timers.push(timer);

		return () => {
			timer.cancelled = true;
		};
	}

	/** Moves the clock, running every timer that falls due on the way (including ones they arm). */
	advance(ms: number): void {
		this.current += ms;

		for (;;) {
			const due = this.timers
				.filter((timer) => !timer.cancelled && timer.at <= this.current)
				.sort((a, b) => a.at - b.at)[0];

			if (!due) {
				break;
			}

			due.cancelled = true;
			due.run();
		}
	}

	/** How many timers are still armed. */
	get armed(): number {
		return this.timers.filter((timer) => !timer.cancelled).length;
	}

	/** The token expiry (seconds since the epoch) a number of seconds from now. */
	expInSeconds(seconds: number): number {
		return Math.floor(this.current / 1000) + seconds;
	}
}

/** A bearer header for a token of a user, expiring at `exp` (seconds since the epoch). */
const bearer = (id: string, exp?: number, secret = 'subscription-session-spec') =>
	`Bearer ${sign(exp === undefined ? { id } : { id, exp }, secret)}`;

/** A promise the spec settles by hand: a lookup that answers when the spec says so. */
const deferred = <T>() => {
	let settle: (value: T) => void = () => undefined;
	const promise = new Promise<T>((resolve) => {
		settle = resolve;
	});

	return { promise, resolve: (value: T) => settle(value) };
};

/** A lookup that neither answers nor fails. */
const stalled = () => new Promise<SubscriptionCredentialVerdict>(() => undefined);

/** Lets every pending callback run, without moving the clock. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** A stream the spec pushes values into, recording whether it was ended. */
const pushStream = <T>() => {
	const values: T[] = [];
	const waiting: Array<(result: IteratorResult<T>) => void> = [];
	let ended = false;

	const iterator: AsyncIterableIterator<T> = {
		next: (): Promise<IteratorResult<T>> => {
			if (values.length > 0) {
				return Promise.resolve({ value: values.shift() as T, done: false });
			}

			if (ended) {
				return Promise.resolve({ value: undefined, done: true });
			}

			return new Promise<IteratorResult<T>>((resolve) => waiting.push(resolve));
		},
		return: (): Promise<IteratorResult<T>> => {
			ended = true;
			for (const resolve of waiting.splice(0)) {
				resolve({ value: undefined, done: true });
			}
			return Promise.resolve({ value: undefined, done: true });
		},
		[Symbol.asyncIterator]() {
			return iterator;
		}
	};

	return {
		iterator,
		push: (value: T) => {
			const resolve = waiting.shift();
			if (resolve) {
				resolve({ value, done: false });
			} else {
				values.push(value);
			}
		},
		get ended() {
			return ended;
		}
	};
};

/** The user the guards authorized a stream with, as `JwtStrategy` attaches one. */
const USER_A = {
	id: 'user-a',
	tenantId: 'tenant-a',
	lastOrganizationId: 'organization-a',
	employeeId: 'employee-a',
	roleId: 'role-employee',
	permissions: ['ORG_EMPLOYEES_VIEW', 'TIME_TRACKER']
};

describe('SubscriptionSession', () => {
	let clock: ManualClock;
	let closes: Array<{ code: number; reason: string }>;
	let verdict: SubscriptionCredentialVerdict;
	let authenticate: jest.Mock<Promise<SubscriptionCredentialVerdict>, [Readonly<Record<string, string>>]>;

	const session = (headers: Record<string, string>, intervalMs = DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS) =>
		new SubscriptionSession({
			headers,
			close: (code, reason) => closes.push({ code, reason }),
			authenticate,
			intervalMs,
			clock
		});

	beforeEach(() => {
		clock = new ManualClock();
		closes = [];
		verdict = { status: 'authenticated', user: { ...USER_A } };
		authenticate = jest.fn<Promise<SubscriptionCredentialVerdict>, [Readonly<Record<string, string>>]>(
			async () => verdict
		);
	});

	describe('the access token’s expiry', () => {
		it('closes an idle socket with 4403 when it passes, though no event arrives', () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(120)) });

			clock.advance(119_999);
			expect(closes).toEqual([]);

			clock.advance(1);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
			expect(closes[0].code).toBe(4403);
			expect(subject.closed).toBe(true);
		});

		it('ends a stream instead of delivering an event that arrives after it', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(60)) });
			subject.confirm(USER_A);
			const source = pushStream<string>();
			const stream = subject.guard(source.iterator, () => USER_A);

			source.push('before');
			expect(await stream.next()).toEqual({ value: 'before', done: false });

			clock.advance(60_000);
			source.push('after');

			expect(await stream.next()).toEqual({ value: undefined, done: true });
			expect(source.ended).toBe(true);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
		});

		it('stops its timer when the socket closes', () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(60)) });
			expect(clock.armed).toBe(1);

			subject.dispose();
			clock.advance(120_000);

			expect(clock.armed).toBe(0);
			expect(closes).toEqual([]);
		});

		it('applies whether or not the credential is judged again', () => {
			session({ authorization: bearer('user-a', clock.expInSeconds(30)) }, 0);

			clock.advance(30_000);

			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
			expect(authenticate).not.toHaveBeenCalled();
		});
	});

	describe('judging the credential again', () => {
		it('withholds the next event from a user deactivated while subscribed, and closes the socket with 4401', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			// The guards authenticated the subscription when it opened.
			subject.confirm(USER_A);
			const source = pushStream<string>();
			const stream = subject.guard(source.iterator, () => USER_A);

			source.push('while active');
			expect(await stream.next()).toEqual({ value: 'while active', done: false });
			// Judged by the guards a moment ago, so not judged again yet.
			expect(authenticate).not.toHaveBeenCalled();

			// The user (or the employee, or the membership the token names) is deactivated.
			verdict = { status: 'refused' };
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			source.push('after deactivation');

			expect(await stream.next()).toEqual({ value: undefined, done: true });
			expect(authenticate).toHaveBeenCalledTimes(1);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.refused]);
			expect(closes[0].code).toBe(4401);
			expect(source.ended).toBe(true);
		});

		it('keeps delivering while the credential still holds, judging it at most once per interval', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const source = pushStream<number>();
			const stream = subject.guard(source.iterator, () => USER_A);

			for (let event = 1; event <= 5; event++) {
				clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS / 4);
				source.push(event);
				expect(await stream.next()).toEqual({ value: event, done: false });
			}

			// 75 s of events, one judgement: at the first event past the interval.
			expect(authenticate).toHaveBeenCalledTimes(1);
			expect(closes).toEqual([]);
		});

		it('shares one judgement between every stream the socket carries', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const first = pushStream<string>();
			const second = pushStream<string>();
			const streams = [subject.guard(first.iterator, () => USER_A), subject.guard(second.iterator, () => USER_A)];

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			first.push('one');
			second.push('two');

			expect(await Promise.all(streams.map((stream) => stream.next()))).toEqual([
				{ value: 'one', done: false },
				{ value: 'two', done: false }
			]);
			expect(authenticate).toHaveBeenCalledTimes(1);
		});

		it('judges the connection’s own credential', async () => {
			const authorization = bearer('user-a', clock.expInSeconds(3600));
			const subject = session({ authorization, 'tenant-id': 'tenant-a' });

			await subject.admit(USER_A);

			expect(authenticate).toHaveBeenCalledWith({ authorization, 'tenant-id': 'tenant-a' });
		});

		it('closes with 4403 a stream whose user now holds other permissions, so the guards decide again on reconnect', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const source = pushStream<string>();
			const stream = subject.guard(source.iterator, () => USER_A);

			verdict = { status: 'authenticated', user: { ...USER_A, permissions: ['TIME_TRACKER'] } };
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			source.push('after the demotion');

			expect(await stream.next()).toEqual({ value: undefined, done: true });
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.changed]);
			expect(closes[0].code).toBe(4403);
		});

		it('closes with 4403 when the strategy finds the token expired', async () => {
			const subject = session({ authorization: bearer('user-a') });
			verdict = { status: 'expired' };

			expect(await subject.admit(USER_A)).toBe(false);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
		});

		it('keeps delivering while the database cannot be reached, for one more interval and no longer', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			verdict = { status: 'unavailable' };

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			expect(await subject.admit(USER_A)).toBe(true);
			// Asked again shortly, not on every event.
			expect(await subject.admit(USER_A)).toBe(true);
			expect(authenticate).toHaveBeenCalledTimes(1);

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			expect(await subject.admit(USER_A)).toBe(false);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.unverified]);
			expect(closes[0].code).toBe(4403);
		});

		it('reads a judgement that throws as one that could not be made, never as a verdict for the user', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			authenticate.mockRejectedValue(new Error('connection lost'));

			// Never confirmed: there is nothing to honour.
			expect(await subject.admit(USER_A)).toBe(false);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.unverified]);
		});

		it('never judges a key pair again: it names no user and carries no expiry', async () => {
			const subject = session({ 'x-app-id': 'app', 'x-api-key': 'key' });

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS * 10);

			expect(await subject.admit()).toBe(true);
			expect(authenticate).not.toHaveBeenCalled();
			expect(clock.armed).toBe(0);
		});

		it('is off with an interval of 0', async () => {
			const subject = session({ authorization: bearer('user-a') }, 0);

			clock.advance(MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS * 10);

			expect(await subject.admit(USER_A)).toBe(true);
			expect(authenticate).not.toHaveBeenCalled();
		});

		it('delivers nothing once it has closed the socket', async () => {
			const subject = session({ authorization: bearer('user-a') });
			verdict = { status: 'refused' };

			expect(await subject.admit(USER_A)).toBe(false);
			verdict = { status: 'authenticated', user: USER_A };
			expect(await subject.admit(USER_A)).toBe(false);
			subject.confirm(USER_A);
			expect(await subject.admit(USER_A)).toBe(false);
			expect(closes).toHaveLength(1);
		});
	});

	describe('a judgement that stalls', () => {
		it('is given up on after the time limit, releasing every stream under the unavailable grace and no longer', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			authenticate.mockImplementation(stalled);
			const first = pushStream<string>();
			const second = pushStream<string>();
			const streams = [subject.guard(first.iterator, () => USER_A), subject.guard(second.iterator, () => USER_A)];

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			first.push('one');
			second.push('two');
			const delivered = Promise.all(streams.map((stream) => stream.next()));
			await flush();
			expect(authenticate).toHaveBeenCalledTimes(1);

			clock.advance(SUBSCRIPTION_REAUTH_TIMEOUT_MS);

			// Read as a database that could not answer: the last confirmation is honoured, as it is for one that fails.
			expect(await delivered).toEqual([
				{ value: 'one', done: false },
				{ value: 'two', done: false }
			]);
			expect(closes).toEqual([]);

			// Past the grace, a judgement that stalls again closes the socket.
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			first.push('three');
			const refused = streams[0].next();
			await flush();
			clock.advance(SUBSCRIPTION_REAUTH_TIMEOUT_MS);

			expect(await refused).toEqual({ value: undefined, done: true });
			expect(authenticate).toHaveBeenCalledTimes(2);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.unverified]);
		});

		it('ignores an answer that arrives after the time limit, which never overwrites a newer verdict', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const late = deferred<SubscriptionCredentialVerdict>();
			authenticate.mockImplementationOnce(() => late.promise);

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			const admitted = subject.admit(USER_A);
			await flush();
			clock.advance(SUBSCRIPTION_REAUTH_TIMEOUT_MS);
			expect(await admitted).toBe(true);

			// The next judgement answers in time.
			clock.advance(SUBSCRIPTION_REAUTH_RETRY_MS);
			expect(await subject.admit(USER_A)).toBe(true);
			expect(authenticate).toHaveBeenCalledTimes(2);

			// The stalled lookup answers at last.
			late.resolve({ status: 'refused' });
			await flush();

			expect(closes).toEqual([]);
			expect(await subject.admit(USER_A)).toBe(true);
			expect(authenticate).toHaveBeenCalledTimes(2);
		});

		it('releases the streams waiting on it when the socket closes', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			authenticate.mockImplementation(stalled);

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			const admitted = subject.admit(USER_A);
			subject.dispose();

			expect(await admitted).toBe(false);
			// Neither the expiry timer nor the time limit is left armed.
			expect(clock.armed).toBe(0);
			expect(closes).toEqual([]);
		});
	});

	describe('a judgement overtaken by a confirmation', () => {
		it('does not restore a permission the guards have since seen removed', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const older = deferred<SubscriptionCredentialVerdict>();
			authenticate.mockImplementationOnce(() => older.promise);

			// An event for a stream authorized with both permissions: the credential is judged again.
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			const admitted = subject.admit(USER_A);
			await flush();
			expect(authenticate).toHaveBeenCalledTimes(1);

			// Meanwhile the user loses a permission and opens another stream, which the guards authorize with what
			// they hold now.
			subject.confirm({ ...USER_A, permissions: ['TIME_TRACKER'] });
			// The older judgement answers last, with the permissions it read before the change.
			older.resolve({ status: 'authenticated', user: { ...USER_A } });

			expect(await admitted).toBe(false);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.changed]);
			expect(closes[0].code).toBe(4403);
		});

		it('hands the callers waiting on it the newer confirmation, which stays in force for the interval', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const older = deferred<SubscriptionCredentialVerdict>();
			authenticate.mockImplementationOnce(() => older.promise);

			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			const admitted = subject.admit(USER_A);
			await flush();

			// Another stream opens; the guards confirm the same authorization.
			subject.confirm({ ...USER_A });
			// The older judgement could not reach the database.
			older.resolve({ status: 'unavailable' });

			expect(await admitted).toBe(true);
			// The confirmation is in force, not the older `unavailable`, which would be asked again within seconds.
			clock.advance(SUBSCRIPTION_REAUTH_RETRY_MS);
			expect(await subject.admit(USER_A)).toBe(true);
			expect(authenticate).toHaveBeenCalledTimes(1);
			expect(closes).toEqual([]);
		});
	});

	describe('a stream authorized before a newer confirmation', () => {
		it('is not given the unavailable grace for more than the last confirmation authorized', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			// The first stream opens with both permissions, and stays idle.
			subject.confirm(USER_A);
			const privileged = pushStream<string>();
			const privilegedStream = subject.guard(privileged.iterator, () => USER_A);

			// The user loses a permission and opens a second stream, which the guards authorize with what they hold now.
			const demoted = { ...USER_A, permissions: ['TIME_TRACKER'] };
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS / 2);
			subject.confirm(demoted);
			const reduced = pushStream<string>();
			const reducedStream = subject.guard(reduced.iterator, () => demoted);

			// When the next judgement falls due, the database cannot be reached.
			verdict = { status: 'unavailable' };
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);

			// The newer stream is authorized as the last confirmation read: the grace applies to it.
			reduced.push('within the reduced permissions');
			expect(await reducedStream.next()).toEqual({ value: 'within the reduced permissions', done: false });
			expect(closes).toEqual([]);

			// The idle stream was authorized with the removed permission: its next event is withheld and the socket
			// is closed with 4403, so every guard decides again on reconnect.
			privileged.push('for the removed permission');
			expect(await privilegedStream.next()).toEqual({ value: undefined, done: true });
			expect(authenticate).toHaveBeenCalledTimes(1);
			expect(closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.changed]);
			expect(closes[0].code).toBe(4403);
			expect(privileged.ended).toBe(true);

			// The socket is closed for the newer stream too.
			reduced.push('after the close');
			expect(await reducedStream.next()).toEqual({ value: undefined, done: true });
		});

		it('keeps the grace for a stream authorized as the credential was last authenticated', async () => {
			const subject = session({ authorization: bearer('user-a', clock.expInSeconds(3600)) });
			subject.confirm(USER_A);
			const source = pushStream<string>();
			const stream = subject.guard(source.iterator, () => USER_A);

			// A judgement reads the same authorization.
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			source.push('judged');
			expect(await stream.next()).toEqual({ value: 'judged', done: false });

			// The next one cannot reach the database: the authorization the last judgement read is honoured.
			verdict = { status: 'unavailable' };
			clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
			source.push('under the grace');
			expect(await stream.next()).toEqual({ value: 'under the grace', done: false });
			expect(authenticate).toHaveBeenCalledTimes(2);
			expect(closes).toEqual([]);
		});
	});
});

describe('resolveSubscriptionReauthIntervalMs', () => {
	// `undefined` is left out: it reads the environment variable, which is what an absent argument means.
	it.each(['', '  ', 'soon', '-5', '10s'])('is the default for %p', (value) => {
		expect(resolveSubscriptionReauthIntervalMs(value)).toBe(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
	});

	it.each(['0', 'off', 'false', 'NO'])('is off for %p', (value) => {
		expect(resolveSubscriptionReauthIntervalMs(value)).toBe(0);
	});

	it('is bounded', () => {
		expect(resolveSubscriptionReauthIntervalMs('10')).toBe(MIN_SUBSCRIPTION_REAUTH_INTERVAL_MS);
		expect(resolveSubscriptionReauthIntervalMs('30000')).toBe(30_000);
		expect(resolveSubscriptionReauthIntervalMs('86400000')).toBe(MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS);
	});
});

describe('bearerTokenExpiry', () => {
	it('reads the expiry of a bearer token, in milliseconds', () => {
		expect(bearerTokenExpiry(bearer('user-a', 1_800_000_000))).toBe(1_800_000_000_000);
		expect(bearerTokenExpiry(`bearer ${bearer('user-a', 1_800_000_000).slice('Bearer '.length)}`)).toBe(
			1_800_000_000_000
		);
	});

	it.each([undefined, '', 'Bearer token', 'Basic dXNlcjpwYXNz', bearer('user-a')])('reads none from %p', (value) => {
		expect(bearerTokenExpiry(value)).toBeUndefined();
	});

	// Passport authenticates these headers (see `authenticateSubscriptionCredential` below), so the session must
	// hold them to the same token's expiry: a stricter reading here left such a socket with no expiry timer and no
	// re-judgement at all.
	it.each<[string, (header: string) => string]>([
		['a trailing segment', (header: string) => `${header} extra`],
		['leading whitespace', (header: string) => `   ${header}`],
		['several spaces after the scheme', (header: string) => header.replace(' ', '   ')]
	])('reads the expiry of a bearer token with %s, as passport reads the header', (_shape, reshape) => {
		expect(bearerTokenExpiry(reshape(bearer('user-a', 1_800_000_000)))).toBe(1_800_000_000_000);
	});
});

describe('bearerTokenOf', () => {
	const token = bearer('user-a', 1_800_000_000).slice('Bearer '.length);

	it('reads the token the way `ExtractJwt.fromAuthHeaderAsBearerToken` does', () => {
		expect(bearerTokenOf(`Bearer ${token}`)).toBe(token);
		expect(bearerTokenOf(`bearer ${token}`)).toBe(token);
		expect(bearerTokenOf(`Bearer ${token} extra`)).toBe(token);
		expect(bearerTokenOf(`\tBearer\t${token}`)).toBe(token);
	});

	it.each([undefined, '', 'Bearer', token, `Token ${token}`, `Basic ${token}`, `x Bearer ${token}`])(
		'reads none from %p',
		(value) => {
			expect(bearerTokenOf(value)).toBeUndefined();
		}
	);
});

describe('sameSubscriptionAuthorization', () => {
	it('does not depend on the order of the permissions', () => {
		expect(
			sameSubscriptionAuthorization(USER_A, { ...USER_A, permissions: [...USER_A.permissions].reverse() })
		).toBe(true);
	});

	it.each<[string, Partial<SubscriptionSessionUser>]>([
		['the role', { roleId: 'role-viewer' }],
		['a permission', { permissions: ['ORG_EMPLOYEES_VIEW'] }],
		['the organization', { lastOrganizationId: 'organization-b' }],
		['the employee', { employeeId: null }],
		['the tenant', { tenantId: 'tenant-b' }]
	])('notices a change of %s', (_change, changed) => {
		expect(sameSubscriptionAuthorization(USER_A, { ...USER_A, ...changed })).toBe(false);
	});

	it('is false when nobody is authenticated', () => {
		expect(sameSubscriptionAuthorization(USER_A, undefined)).toBe(false);
	});
});

/**
 * The session on a `graphql-ws` socket: the transport's options, the context factory `graphql-helper.ts`
 * installs and a subscription field guarded the way the global `AuthGuard` guards one (the credential
 * authenticates a user, attached to the operation's request). Closing the socket ends the connection, as the
 * `ws` adapter does.
 */
describe('a subscription socket held to its credential', () => {
	const TOPIC = 'widget.changed:tenant-a';
	const originalClsService = RequestContext['clsService'];

	let clock: ManualClock;
	let broker: GraphqlTopicBroker;
	/** What judging each user's credential again answers now. */
	let state: Record<string, SubscriptionCredentialVerdict>;
	let authenticate: jest.Mock<Promise<SubscriptionCredentialVerdict>, [Readonly<Record<string, string>>]>;

	const createSchema = () => {
		const schema = buildSchema(`
			type Query { ok: Boolean }
			type Subscription { widgetChanged: Widget }
			type Widget { id: ID! }
		`);
		const field = schema.getSubscriptionType()!.getFields()['widgetChanged'];

		field.subscribe = (
			_root: unknown,
			_args: unknown,
			context: { req: { headers: Record<string, string>; user?: unknown } }
		) => {
			const id = userIdOf(context.req.headers['authorization']);
			if (!id || state[id]?.status !== 'authenticated') {
				throw new UnauthorizedException();
			}
			context.req.user = { ...(state[id] as { user: SubscriptionSessionUser }).user };

			return broker.asyncIterableIterator(TOPIC);
		};
		field.resolve = (payload: unknown) => payload;

		return schema;
	};

	/** The user a bearer header names (the spec's tokens are only decoded here; the session never verifies them). */
	const userIdOf = (authorization?: string): string | undefined => {
		try {
			const token = (authorization ?? '').replace(/^Bearer\s+/i, '');
			return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).id;
		} catch {
			return undefined;
		}
	};

	const connect = () => {
		const sent: any[] = [];
		const closes: Array<{ code?: number; reason?: string }> = [];
		let receive: (data: string) => Promise<void> = async () => undefined;
		let release: (code: number, reason: string) => Promise<void> = async () => undefined;

		const server = makeServer({
			schema: createSchema(),
			context: (connection: unknown) => createGraphqlRequestContext(graphqlContextArguments(connection)),
			...createSubscriptionServerOptions({ authenticate, clock })
		} as any);

		const socket = {
			close: (code?: number, reason?: string) => {
				if (closes.length === 0) {
					closes.push({ code, reason });
					void release(code ?? 1000, reason ?? '');
				}
			}
		};

		release = server.opened(
			{
				protocol: GRAPHQL_TRANSPORT_WS_PROTOCOL,
				send: async (data: string) => {
					if (closes.length === 0) {
						sent.push(JSON.parse(data));
					}
				},
				close: (code?: number, reason?: string) => socket.close(code, reason),
				onMessage: (callback: (data: string) => Promise<void>) => {
					receive = callback;
				}
			},
			{ socket, request: { headers: {} } }
		) as (code: number, reason: string) => Promise<void>;

		return {
			sent,
			closes,
			send: (message: unknown) => receive(JSON.stringify(message)),
			results: (id: string) =>
				sent
					.filter((message) => message.id === id && message.type === 'next')
					.map((message) => message.payload),
			release: () => release(1000, 'done')
		};
	};

	/** Lets pending work run until a condition holds, without a timer. */
	const until = async (condition: () => boolean): Promise<void> => {
		for (let turn = 0; turn < 500 && !condition(); turn++) {
			await new Promise((resolve) => setImmediate(resolve));
		}

		expect(condition()).toBe(true);
	};

	const SUBSCRIBE = { id: 's', type: 'subscribe', payload: { query: 'subscription { widgetChanged { id } }' } };

	beforeEach(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		clock = new ManualClock();
		broker = new GraphqlTopicBroker();
		state = { 'user-a': { status: 'authenticated', user: { ...USER_A } } };
		authenticate = jest.fn<Promise<SubscriptionCredentialVerdict>, [Readonly<Record<string, string>>]>(
			async (headers) => state[userIdOf(headers['authorization']) ?? ''] ?? { status: 'refused' }
		);
	});

	afterEach(() => {
		broker.close();
		RequestContext['clsService'] = originalClsService;
	});

	it('refuses at connection_init a token whose expiry has passed', async () => {
		const socket = connect();

		await socket.send({
			type: 'connection_init',
			payload: { Authorization: bearer('user-a', clock.expInSeconds(-1)) }
		});

		expect(socket.closes).toEqual([{ code: 4403, reason: 'Forbidden' }]);
		expect(socket.sent).toEqual([]);
	});

	it('closes the socket with 4403 when the token expires, and ends its subscriptions', async () => {
		const socket = connect();

		await socket.send({
			type: 'connection_init',
			payload: { Authorization: bearer('user-a', clock.expInSeconds(300)) }
		});
		const open = socket.send(SUBSCRIBE);
		await until(() => broker.subscriberCount(TOPIC) === 1);

		clock.advance(300_000);
		await open;

		expect(socket.closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
		expect(broker.subscriberCount(TOPIC)).toBe(0);
	});

	it('holds a token followed by a trailing segment to its expiry, as passport authenticates it', async () => {
		const socket = connect();

		await socket.send({
			type: 'connection_init',
			payload: { Authorization: `${bearer('user-a', clock.expInSeconds(300))} extra` }
		});
		const open = socket.send(SUBSCRIBE);
		await until(() => broker.subscriberCount(TOPIC) === 1);

		clock.advance(300_000);
		await open;

		expect(socket.closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.expired]);
		expect(broker.subscriberCount(TOPIC)).toBe(0);
	});

	it('judges again a token followed by a trailing segment, and closes the socket with 4401 once it is refused', async () => {
		const socket = connect();
		const authorization = `${bearer('user-a', clock.expInSeconds(3600))} extra`;

		await socket.send({ type: 'connection_init', payload: { Authorization: authorization } });
		const open = socket.send(SUBSCRIBE);
		await until(() => broker.subscriberCount(TOPIC) === 1);

		state['user-a'] = { status: 'refused' };
		clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
		broker.publish(TOPIC, { id: 'w-1' });
		await open;

		expect(socket.results('s')).toEqual([]);
		expect(authenticate).toHaveBeenCalledWith({ authorization });
		expect(socket.closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.refused]);
		expect(broker.subscriberCount(TOPIC)).toBe(0);
	});

	it('withholds the next event from a user deactivated while subscribed, and closes the socket with 4401', async () => {
		const socket = connect();

		await socket.send({
			type: 'connection_init',
			payload: { Authorization: bearer('user-a', clock.expInSeconds(3600)) }
		});
		const open = socket.send(SUBSCRIBE);
		await until(() => broker.subscriberCount(TOPIC) === 1);

		broker.publish(TOPIC, { id: 'w-1' });
		await until(() => socket.results('s').length === 1);
		// The guards judged the credential when the subscription opened; nothing was judged again yet.
		expect(authenticate).not.toHaveBeenCalled();

		state['user-a'] = { status: 'refused' };
		clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
		broker.publish(TOPIC, { id: 'w-2' });
		await open;

		expect(socket.results('s')).toEqual([{ data: { widgetChanged: { id: 'w-1' } } }]);
		expect(socket.closes).toEqual([SUBSCRIPTION_SESSION_CLOSE.refused]);
		expect(authenticate).toHaveBeenCalledTimes(1);
		expect(broker.subscriberCount(TOPIC)).toBe(0);
	});

	it('keeps a subscription whose credential still holds', async () => {
		const socket = connect();

		await socket.send({
			type: 'connection_init',
			payload: { Authorization: bearer('user-a', clock.expInSeconds(3600)) }
		});
		const open = socket.send(SUBSCRIBE);
		await until(() => broker.subscriberCount(TOPIC) === 1);

		clock.advance(DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS);
		broker.publish(TOPIC, { id: 'w-1' });
		await until(() => socket.results('s').length === 1);

		await socket.send({ id: 's', type: 'complete' });
		await open;
		await socket.release();

		expect(socket.closes).toEqual([]);
		expect(authenticate).toHaveBeenCalledTimes(1);
		expect(broker.subscriberCount(TOPIC)).toBe(0);
	});
});

/**
 * The default judgement: a request carrying the connection's headers, put to the passport strategy the global
 * `AuthGuard` uses. Registered here under the platform's name, with the verdict a `JwtStrategy` lookup would
 * reach for each user.
 */
describe('authenticateSubscriptionCredential', () => {
	const SECRET = 'subscription-session-spec-secret';
	const originalClsService = RequestContext['clsService'];

	/** What the strategy's lookup does for a token's payload. */
	let lookup: (payload: { id: string }) => unknown;
	/** The user the request context held while the strategy ran. */
	let seenInContext: unknown;

	const tokenFor = (id: string, expiresInSeconds = 3600) =>
		`Bearer ${sign({ id, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }, SECRET)}`;

	beforeEach(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		seenInContext = 'never ran';
		lookup = (payload) => ({ id: payload.id, tenantId: 'tenant-a' });

		passport.use(
			'jwt',
			new PassportJwtStrategy(
				{ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: SECRET },
				(payload: { id: string }, done: (error: unknown, user?: unknown) => void) => {
					seenInContext = RequestContext.currentUser();
					try {
						done(null, lookup(payload));
					} catch (error) {
						done(error);
					}
				}
			)
		);
	});

	afterEach(() => {
		passport.unuse('jwt');
		RequestContext['clsService'] = originalClsService;
	});

	it('answers the user the strategy authenticates', async () => {
		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })).toEqual({
			status: 'authenticated',
			user: { id: 'user-a', tenantId: 'tenant-a' }
		});
	});

	it('authenticates a bearer header with a trailing segment, which is why the session must hold it to account', async () => {
		expect(await authenticateSubscriptionCredential({ authorization: `${tokenFor('user-a')} extra` })).toEqual({
			status: 'authenticated',
			user: { id: 'user-a', tenantId: 'tenant-a' }
		});
	});

	it('judges in a request context of its own, holding no user yet, as an HTTP request is judged', async () => {
		await RequestContext.runWithRequest({ user: { id: 'subscriber' } } as never, () =>
			authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })
		);

		expect(seenInContext).toBeNull();
	});

	it('answers expired for a token whose expiry passed', async () => {
		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a', -10) })).toEqual({
			status: 'expired'
		});
	});

	it('refuses a user the strategy refuses: deactivated, archived, or no longer a member', async () => {
		lookup = () => {
			throw new UnauthorizedException('unauthorized');
		};
		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })).toEqual({
			status: 'refused'
		});

		lookup = () => false;
		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })).toEqual({
			status: 'refused'
		});
	});

	it('refuses a token that does not verify', async () => {
		const forged = `Bearer ${sign({ id: 'user-a' }, 'another-secret')}`;

		expect(await authenticateSubscriptionCredential({ authorization: forged })).toEqual({ status: 'refused' });
	});

	it('answers unavailable when the database could not be reached, which says nothing about the user', async () => {
		lookup = () => {
			throw new ServiceUnavailableException();
		};

		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })).toEqual({
			status: 'unavailable'
		});
	});

	it('answers unavailable when no strategy is registered under the name', async () => {
		passport.unuse('jwt');

		expect(await authenticateSubscriptionCredential({ authorization: tokenFor('user-a') })).toEqual({
			status: 'unavailable'
		});
	});
});
