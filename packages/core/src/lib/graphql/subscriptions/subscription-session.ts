import { decode } from 'jsonwebtoken';
import { SubscriptionClock, systemSubscriptionClock } from './subscription-delivery';

/**
 * The credential of a subscription socket, held to account for as long as the socket is open.
 *
 * 🛑 **A socket used to be authenticated once.** The guards judge an operation when it opens: a
 * subscription is authenticated at `subscribe`, and from then on every event its stream produces is
 * delivered with no further question. An access token that expired, a user who was deactivated or
 * archived, an employee who was deactivated (the rule ever-co/ever-gauzy#11336 applies where tokens are
 * minted), a membership that was revoked, a role that was changed — none of them reached a stream that
 * was already open, which kept delivering until the client hung up. On HTTP every one of them takes
 * effect on the next request, because `JwtStrategy` judges every request again.
 *
 * A session is that "next request" for a socket:
 *
 * - **the token's expiry is a timer.** The `exp` of the bearer token the connection presented is read
 *   when the connection is accepted, and the socket is closed when it passes — idle or not — with
 *   `4403 Forbidden`, which is what `graphql-ws` clients reconnect on (`connectionParams`, when it is a
 *   function, is asked again on every connection, so a client that refreshed its token reconnects with
 *   it). A token whose expiry has already passed is refused at `connection_init`.
 * - **the credential is judged again before an event is delivered**, by the same strategy that judges an
 *   HTTP request (see `authenticateSubscriptionCredential`), at most once per interval per connection
 *   (`GRAPHQL_SUBSCRIPTION_REAUTH_INTERVAL_MS`, 60 s by default) and with one lookup shared by every stream
 *   the socket carries. A socket with no event to deliver costs nothing. When the credential no longer
 *   authenticates anybody the event is withheld and the socket is closed with `4401 Unauthorized`, which a
 *   `graphql-ws` client does not retry; when it still does but the role, permissions, tenant, organization
 *   or employee it resolves to differ from what the stream was authorized with, the socket is closed with
 *   `4403 Forbidden`, so the client reconnects and every guard decides again with what the user holds now.
 *
 * The session decides nothing the guards do not: it reuses their verdict and only refuses to let a stream
 * outlive it. A stream that opened without authenticating (a public field) is not held to the credential.
 */

/** The close code for a credential that no longer authenticates anybody. `graphql-ws` clients do not retry it. */
export const SUBSCRIPTION_CLOSE_UNAUTHORIZED = 4401;

/** The close code for a credential that has to be presented again. `graphql-ws` clients reconnect on it. */
export const SUBSCRIPTION_CLOSE_FORBIDDEN = 4403;

/**
 * Why a session closed its socket.
 */
export interface SubscriptionSessionCloseReason {
	/** The WebSocket close code. */
	readonly code: number;
	/** The close reason, well under the 123 bytes a close frame carries. */
	readonly reason: string;
}

/**
 * The reasons a session closes its socket with.
 */
export const SUBSCRIPTION_SESSION_CLOSE: Readonly<
	Record<'expired' | 'changed' | 'unverified' | 'refused', SubscriptionSessionCloseReason>
> = {
	/** The access token's `exp` passed. The client refreshes it and reconnects. */
	expired: { code: SUBSCRIPTION_CLOSE_FORBIDDEN, reason: 'Forbidden: access token expired' },
	/** The credential authenticates the same user, with another role, permissions or scope. */
	changed: { code: SUBSCRIPTION_CLOSE_FORBIDDEN, reason: 'Forbidden: authorization changed' },
	/** The credential could not be judged again for longer than the interval allows. */
	unverified: { code: SUBSCRIPTION_CLOSE_FORBIDDEN, reason: 'Forbidden: credential could not be re-validated' },
	/** The credential no longer authenticates anybody: deactivated, archived, revoked, invalid. */
	refused: { code: SUBSCRIPTION_CLOSE_UNAUTHORIZED, reason: 'Unauthorized' }
};

/** How often (ms) a connection's credential is judged again when the setting is absent or unreadable. */
export const DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS = 60_000;

/** The shortest interval accepted, so a setting cannot turn every event into a database round trip. */
export const MIN_SUBSCRIPTION_REAUTH_INTERVAL_MS = 1_000;

/**
 * The longest interval accepted: the longest a deactivated account's open stream may still be served. The
 * same bound `JWT_AUTHENTICATED_USER_TTL_MS` has on HTTP.
 */
export const MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS = 5 * 60_000;

/** How soon a judgement that could not be made (the database unreachable) is attempted again. */
export const SUBSCRIPTION_REAUTH_RETRY_MS = 5_000;

/** The longest delay a Node timer takes; a longer one fires at once, so a later expiry is re-armed. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

/**
 * The interval, from `GRAPHQL_SUBSCRIPTION_REAUTH_INTERVAL_MS`: milliseconds, bounded to
 * [{@link MIN_SUBSCRIPTION_REAUTH_INTERVAL_MS}, {@link MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS}]; `0` / `false` / `off`
 * / `no` switch the re-validation off (the expiry timer stays). Anything unreadable is the default: a typo never
 * switches the check off.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns The interval in milliseconds; `0` when the re-validation is off.
 */
export function resolveSubscriptionReauthIntervalMs(
	value: string | undefined = process.env.GRAPHQL_SUBSCRIPTION_REAUTH_INTERVAL_MS
): number {
	if (value === undefined || value === null || String(value).trim() === '') {
		return DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS;
	}

	const normalized = String(value).trim().toLowerCase();
	if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
		return 0;
	}

	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_SUBSCRIPTION_REAUTH_INTERVAL_MS;
	}

	return Math.min(
		Math.max(Math.floor(parsed), MIN_SUBSCRIPTION_REAUTH_INTERVAL_MS),
		MAX_SUBSCRIPTION_REAUTH_INTERVAL_MS
	);
}

/**
 * The part of an authenticated user a session compares: what the guards authorized a stream with.
 */
export interface SubscriptionSessionUser {
	readonly id?: unknown;
	readonly tenantId?: unknown;
	readonly roleId?: unknown;
	readonly employeeId?: unknown;
	readonly lastOrganizationId?: unknown;
	readonly permissions?: readonly unknown[];
}

/**
 * What judging a connection's credential again answered.
 */
export type SubscriptionCredentialVerdict =
	/** The credential authenticates this user, as the database reads now. */
	| { readonly status: 'authenticated'; readonly user: SubscriptionSessionUser }
	/** The token's expiry passed. */
	| { readonly status: 'expired' }
	/** The credential authenticates nobody: the user, the employee or the membership is gone or inactive. */
	| { readonly status: 'refused' }
	/** The credential could not be judged (the database could not be reached); it is asked again shortly. */
	| { readonly status: 'unavailable' };

/**
 * Judges a connection's credential again, from the connection's normalised headers.
 */
export type SubscriptionCredentialAuthenticator = (
	headers: Readonly<Record<string, string>>
) => Promise<SubscriptionCredentialVerdict>;

/**
 * What a session is built from.
 */
export interface SubscriptionSessionOptions {
	/** The connection's normalised headers: the credential and the scope it stated. */
	readonly headers: Readonly<Record<string, string>>;
	/** Closes the connection's socket. */
	readonly close: (code: number, reason: string) => void;
	/** Judges the credential again. Without one only the expiry timer applies. */
	readonly authenticate?: SubscriptionCredentialAuthenticator;
	/** How often (ms) the credential is judged again; `0` never. Defaults to {@link resolveSubscriptionReauthIntervalMs}. */
	readonly intervalMs?: number;
	/** The clock, for specs. */
	readonly clock?: SubscriptionClock;
}

/**
 * The bearer token in an `Authorization` header, as `ExtractJwt.fromAuthHeaderAsBearerToken` reads it.
 *
 * @param authorization The header's value.
 * @returns The token, or undefined.
 */
export function bearerTokenOf(authorization: string | undefined): string | undefined {
	const match = /^\s*bearer\s+(\S+)\s*$/i.exec(authorization ?? '');
	return match ? match[1] : undefined;
}

/**
 * When a bearer token expires (ms since the epoch), read from its `exp` claim.
 *
 * The token is decoded, not verified: verifying it is the guards' business, and they refuse every
 * operation a forged token sends. The expiry read here only ever ends a socket sooner.
 *
 * @param authorization The `Authorization` header's value.
 * @returns The expiry, or undefined when the header carries no token with a numeric `exp`.
 */
export function bearerTokenExpiry(authorization: string | undefined): number | undefined {
	const token = bearerTokenOf(authorization);
	if (!token) {
		return undefined;
	}

	try {
		const payload = decode(token, { json: true });
		const exp = payload?.exp;

		return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Whether a freshly authenticated user is authorized as the stream was when it opened: the same user, tenant,
 * organization, employee and role, and the same permissions. Anything else is a change the guards have to
 * decide on again.
 *
 * @param before The user the guards authorized the stream with.
 * @param after The user the credential authenticates now.
 * @returns True when nothing the guards decided on has changed.
 */
export function sameSubscriptionAuthorization(
	before: SubscriptionSessionUser,
	after: SubscriptionSessionUser | undefined
): boolean {
	if (!after) {
		return false;
	}

	const same = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

	return (
		same(before.id, after.id) &&
		same(before.tenantId, after.tenantId) &&
		same(before.lastOrganizationId, after.lastOrganizationId) &&
		same(before.employeeId, after.employeeId) &&
		same(before.roleId, after.roleId) &&
		permissionsKey(before.permissions) === permissionsKey(after.permissions)
	);
}

/**
 * A permission list as a value that does not depend on the order the database returned it in.
 *
 * @param permissions The permissions.
 * @returns The key.
 */
function permissionsKey(permissions: readonly unknown[] | undefined): string {
	return Array.isArray(permissions)
		? Array.from(new Set(permissions.map(String)))
				.sort()
				.join(',')
		: '';
}

/**
 * One connection's credential, from `connection_init` until the socket closes.
 */
export class SubscriptionSession {
	/** When the bearer token expires (ms since the epoch), when it carries an expiry. */
	readonly expiresAt?: number;

	private readonly intervalMs: number;
	private readonly reauthenticates: boolean;

	private verdict?: SubscriptionCredentialVerdict;
	private verdictAt = Number.NEGATIVE_INFINITY;
	private confirmedAt?: number;
	private pending?: Promise<SubscriptionCredentialVerdict>;
	private cancelExpiry?: () => void;
	private closedWith?: SubscriptionSessionCloseReason;
	private disposed = false;

	/**
	 * @param options The connection's credential, how to close it and how to judge it again.
	 */
	constructor(private readonly options: SubscriptionSessionOptions) {
		this.expiresAt = bearerTokenExpiry(options.headers['authorization']);
		this.intervalMs = Math.max(0, options.intervalMs ?? resolveSubscriptionReauthIntervalMs());
		// Only a bearer token is judged again: it is what the global `AuthGuard` authenticates every operation
		// with. A key pair carries no expiry and no user to re-read.
		this.reauthenticates =
			Boolean(bearerTokenOf(options.headers['authorization'])) &&
			typeof options.authenticate === 'function' &&
			this.intervalMs > 0;

		this.armExpiry();
	}

	/**
	 * The clock in force.
	 */
	private get clock(): SubscriptionClock {
		return this.options.clock ?? systemSubscriptionClock;
	}

	/** Whether the session has ended: closed by a check, or its socket went away. */
	get closed(): boolean {
		return this.disposed || this.closedWith !== undefined;
	}

	/** Why the session closed its socket, when it did. */
	get closeReason(): SubscriptionSessionCloseReason | undefined {
		return this.closedWith;
	}

	/**
	 * Whether the bearer token's expiry has passed.
	 *
	 * @returns True once it has.
	 */
	hasExpired(): boolean {
		return this.expiresAt !== undefined && this.clock.now() >= this.expiresAt;
	}

	/**
	 * Records that the guards have just authenticated the credential: an operation on the socket opened with
	 * it. The next judgement is due an interval from now, so a stream that has just opened is not judged twice.
	 *
	 * @param user The user the guards authenticated.
	 */
	confirm(user: SubscriptionSessionUser): void {
		if (this.closed) {
			return;
		}

		const now = this.clock.now();
		this.verdict = { status: 'authenticated', user };
		this.verdictAt = now;
		this.confirmedAt = now;
	}

	/**
	 * Decides whether an event may be delivered to a stream the guards authorized with `baseline`, judging the
	 * credential again first when the last judgement is older than the interval. A refusal closes the socket.
	 *
	 * @param baseline The user the stream was authorized with.
	 * @returns True when the event may be delivered.
	 */
	async admit(baseline?: SubscriptionSessionUser): Promise<boolean> {
		if (this.closed) {
			return false;
		}

		if (this.hasExpired()) {
			this.close(SUBSCRIPTION_SESSION_CLOSE.expired);
			return false;
		}

		if (!this.reauthenticates) {
			return true;
		}

		const verdict = await this.currentVerdict();

		if (this.closed) {
			return false;
		}

		switch (verdict.status) {
			case 'authenticated':
				if (baseline && !sameSubscriptionAuthorization(baseline, verdict.user)) {
					this.close(SUBSCRIPTION_SESSION_CLOSE.changed);
					return false;
				}
				return true;
			case 'expired':
				this.close(SUBSCRIPTION_SESSION_CLOSE.expired);
				return false;
			case 'unavailable':
				// A database that cannot be reached is not a verdict against the user, and closing every socket
				// at once would multiply the load that caused it — so the last confirmation is honoured for one
				// more interval, and no longer.
				if (this.confirmedAt !== undefined && this.clock.now() - this.confirmedAt < 2 * this.intervalMs) {
					return true;
				}
				this.close(SUBSCRIPTION_SESSION_CLOSE.unverified);
				return false;
			default:
				this.close(SUBSCRIPTION_SESSION_CLOSE.refused);
				return false;
		}
	}

	/**
	 * Holds a stream to the session: before each value it yields is delivered, {@link admit} decides, and a
	 * refusal ends the stream instead of delivering the value.
	 *
	 * @param stream The stream an operation opened.
	 * @param baseline The user the guards authorized the operation with.
	 * @returns The stream, held to the session.
	 */
	guard<T>(stream: AsyncIterable<T>, baseline: () => SubscriptionSessionUser | undefined): AsyncIterableIterator<T> {
		const iterator = stream[Symbol.asyncIterator]();

		const end = async (): Promise<IteratorResult<T>> => {
			try {
				await iterator.return?.(undefined);
			} catch {
				// The stream is being abandoned; a failure to release it changes nothing the client sees.
			}

			return { value: undefined, done: true };
		};

		const guarded: AsyncIterableIterator<T> = {
			next: async (...args: [] | [unknown]): Promise<IteratorResult<T>> => {
				if (this.closed) {
					return end();
				}

				const result = await iterator.next(...args);

				if (result.done) {
					return result;
				}

				return (await this.admit(baseline())) ? result : end();
			},
			return: (value?: unknown): Promise<IteratorResult<T>> =>
				typeof iterator.return === 'function'
					? iterator.return(value)
					: Promise.resolve({ value: undefined, done: true } as IteratorResult<T>),
			throw: (error?: unknown): Promise<IteratorResult<T>> =>
				typeof iterator.throw === 'function' ? iterator.throw(error) : Promise.reject(error),
			[Symbol.asyncIterator]() {
				return guarded;
			}
		};

		return guarded;
	}

	/**
	 * Closes the socket, once.
	 *
	 * @param reason Why.
	 */
	close(reason: SubscriptionSessionCloseReason): void {
		if (this.closed) {
			return;
		}

		this.closedWith = reason;
		this.dispose();

		try {
			this.options.close(reason.code, reason.reason);
		} catch {
			// The socket is already gone.
		}
	}

	/**
	 * Ends the session without closing anything: its socket closed. Cancels the expiry timer.
	 */
	dispose(): void {
		this.disposed = true;
		this.cancelExpiry?.();
		this.cancelExpiry = undefined;
	}

	/**
	 * The judgement in force: the last one while it is fresh, or a new one, shared by every caller that asks
	 * while it runs.
	 *
	 * @returns The verdict.
	 */
	private currentVerdict(): Promise<SubscriptionCredentialVerdict> {
		if (this.verdict && this.clock.now() - this.verdictAt < this.freshFor(this.verdict)) {
			return Promise.resolve(this.verdict);
		}

		if (!this.pending) {
			const authenticate = this.options.authenticate as SubscriptionCredentialAuthenticator;
			const pending = Promise.resolve()
				.then(() => authenticate(this.options.headers))
				.catch((): SubscriptionCredentialVerdict => ({ status: 'unavailable' }))
				.then((verdict) => {
					const settled: SubscriptionCredentialVerdict = verdict ?? { status: 'unavailable' };
					this.verdict = settled;
					this.verdictAt = this.clock.now();

					if (settled.status === 'authenticated') {
						this.confirmedAt = this.verdictAt;
					}

					return settled;
				})
				.finally(() => {
					if (this.pending === pending) {
						this.pending = undefined;
					}
				});

			this.pending = pending;
		}

		return this.pending;
	}

	/**
	 * How long a verdict is reused.
	 *
	 * @param verdict The verdict.
	 * @returns Milliseconds.
	 */
	private freshFor(verdict: SubscriptionCredentialVerdict): number {
		return verdict.status === 'unavailable'
			? Math.min(this.intervalMs, SUBSCRIPTION_REAUTH_RETRY_MS)
			: this.intervalMs;
	}

	/**
	 * Schedules the close at the token's expiry, in steps no longer than a timer takes.
	 */
	private armExpiry(): void {
		if (this.expiresAt === undefined || this.closed) {
			return;
		}

		const delay = Math.min(Math.max(this.expiresAt - this.clock.now(), 0), MAX_TIMER_DELAY_MS);

		this.cancelExpiry = this.clock.schedule(() => {
			this.cancelExpiry = undefined;

			if (this.closed) {
				return;
			}

			if (this.hasExpired()) {
				this.close(SUBSCRIPTION_SESSION_CLOSE.expired);
			} else {
				this.armExpiry();
			}
		}, delay);
	}
}

/** Where a socket operation's request carries the session of its connection. */
const SUBSCRIPTION_SESSION = Symbol('gauzySubscriptionSession');

/**
 * Hands a socket operation's request the session of its connection.
 *
 * @param req The request the context factory built for the operation.
 * @param session The connection's session.
 */
export function attachSubscriptionSession(req: object, session: SubscriptionSession | undefined): void {
	if (!session || !req || typeof req !== 'object') {
		return;
	}

	Object.defineProperty(req, SUBSCRIPTION_SESSION, { value: session, enumerable: false, configurable: true });
}

/**
 * The session of the connection an operation's request was built for.
 *
 * @param req The operation's request.
 * @returns The session, or undefined for an HTTP request.
 */
export function subscriptionSessionOf(req: unknown): SubscriptionSession | undefined {
	const session =
		req && typeof req === 'object'
			? (req as { [SUBSCRIPTION_SESSION]?: unknown })[SUBSCRIPTION_SESSION]
			: undefined;

	return session instanceof SubscriptionSession ? session : undefined;
}
