import { Provider, UnauthorizedException } from '@nestjs/common';
import { IAuthenticatedUser } from '../../core/context/types';
import { getORMType, MultiORM, MultiORMEnum } from '../../core/utils';

/** The access-token claims a validated user context is keyed by. */
export interface AuthenticatedUserClaims {
	id?: string;
	thirdPartyId?: string;
	employeeId?: string;
	organizationId?: string;
	tenantId?: string;
}

/** How long (ms) a validated context is reused when `JWT_AUTHENTICATED_USER_TTL_MS` is not set. */
export const DEFAULT_AUTHENTICATED_USER_TTL_MS = 10_000;

/**
 * The longest reuse window accepted: the window within which an off-boarded account (a deactivated or archived
 * user, employee or membership, a changed role) may still be served, so it is bounded whatever the setting says.
 */
export const MAX_AUTHENTICATED_USER_TTL_MS = 5 * 60 * 1000;

/** How many validated contexts a process keeps at most. */
export const DEFAULT_AUTHENTICATED_USER_CACHE_SIZE = 10_000;

/**
 * The reuse window, from `JWT_AUTHENTICATED_USER_TTL_MS`: milliseconds, `0` / `false` / `off` to re-read on every
 * request, anything unreadable the default, and never more than {@link MAX_AUTHENTICATED_USER_TTL_MS}.
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns The window in milliseconds; `0` disables the reuse.
 */
export function resolveAuthenticatedUserTtlMs(
	value: string | undefined = process.env.JWT_AUTHENTICATED_USER_TTL_MS
): number {
	if (value === undefined || value === null || value.trim() === '') {
		return DEFAULT_AUTHENTICATED_USER_TTL_MS;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'false' || normalized === 'off' || normalized === 'no') {
		return 0;
	}
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_AUTHENTICATED_USER_TTL_MS;
	}
	return Math.min(Math.floor(parsed), MAX_AUTHENTICATED_USER_TTL_MS);
}

/**
 * The key a token's claims resolve under. Every claim the strategy reads takes part, so two tokens that name
 * different employees or organizations never share a context; an absent claim and an empty one are the same.
 *
 * @param claims The claims of the access token.
 * @returns The cache key.
 */
export function authenticatedUserCacheKey(claims: AuthenticatedUserClaims): string {
	return [claims.id, claims.thirdPartyId, claims.employeeId, claims.organizationId, claims.tenantId]
		.map((claim) => (claim === undefined || claim === null ? '' : String(claim)))
		.join('\u0000');
}

/**
 * A request's own copy of a validated user: the same prototype (so `@Exclude` and the other class-transformer
 * metadata still apply when it is serialised) and every own property, accessors included, so what one request
 * does to its `request.user` never reaches another request served from the same context. The role, the
 * permissions and the eager relations are shared and are read, never written, by the request pipeline.
 *
 * @param user The validated user.
 * @returns A shallow copy of it.
 */
export function cloneAuthenticatedUser<T extends IAuthenticatedUser>(user: T): T {
	return Object.create(Object.getPrototypeOf(user), Object.getOwnPropertyDescriptors(user)) as T;
}

export interface AuthenticatedUserCacheOptions {
	/** The reuse window in milliseconds; `0` disables the reuse. Defaults to {@link resolveAuthenticatedUserTtlMs}. */
	ttlMs?: number;
	/** How many contexts are kept at most. Defaults to {@link DEFAULT_AUTHENTICATED_USER_CACHE_SIZE}. */
	maxEntries?: number;
	/** The ORM in use. Defaults to `DB_ORM`. */
	ormType?: MultiORM;
	/** The clock, for tests. */
	now?: () => number;
}

interface AuthenticatedUserEntry {
	user: IAuthenticatedUser;
	expiresAt: number;
}

/**
 * The validated contexts of recently seen access tokens, per process.
 *
 * `JwtStrategy` judges every authenticated request against the database: the user's row, the role and
 * permissions it holds now, the employee and the organization membership the token names. That is one to three
 * round trips before any handler runs, on every request, and a tracker or an opening web client sends dozens of
 * requests with one token within a second. A context that was just validated is reused for the next requests
 * carrying the same claims, for {@link resolveAuthenticatedUserTtlMs} milliseconds; concurrent requests with the
 * same claims share one lookup. Only a context that authenticated is kept: a refusal is judged afresh every time,
 * so a reactivated account is served at once and nothing a caller sends can be cached as a verdict against them.
 *
 * Under MikroORM the reuse is off: the user is an entity the request's unit of work manages, and cannot be handed
 * to another request.
 *
 * Not `@Injectable()`: its constructor takes plain options, which Nest would try to resolve as a dependency.
 * A module registers it through {@link AuthenticatedUserCacheProvider}.
 */
export class AuthenticatedUserCache {
	private readonly ttlMs: number;
	private readonly maxEntries: number;
	private readonly now: () => number;
	private readonly entries = new Map<string, AuthenticatedUserEntry>();
	private readonly loading = new Map<string, Promise<IAuthenticatedUser | UnauthorizedException>>();
	/** Bumped by `forget` and `clear`: a lookup that started before is not kept when it settles. */
	private generation = 0;

	constructor(options: AuthenticatedUserCacheOptions = {}) {
		const ormType = options.ormType ?? getORMType();
		const ttlMs = options.ttlMs ?? resolveAuthenticatedUserTtlMs();
		this.ttlMs = ormType === MultiORMEnum.MikroORM ? 0 : Math.max(0, ttlMs);
		this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_AUTHENTICATED_USER_CACHE_SIZE);
		this.now = options.now ?? Date.now;
	}

	/** Whether validated contexts are reused at all. */
	get enabled(): boolean {
		return this.ttlMs > 0;
	}

	/** How many contexts are held right now (expired ones included until they are touched or evicted). */
	get size(): number {
		return this.entries.size;
	}

	/**
	 * The validated context of a token: the one kept for its claims, or the outcome of `load`, kept when it
	 * authenticated. Each caller gets its own copy of the user.
	 *
	 * @param claims The claims of the access token.
	 * @param load Judges the token against the database.
	 * @returns The authenticated user, or the refusal `load` returned.
	 */
	async resolve(
		claims: AuthenticatedUserClaims,
		load: () => Promise<IAuthenticatedUser | UnauthorizedException>
	): Promise<IAuthenticatedUser | UnauthorizedException> {
		if (!this.enabled) {
			return load();
		}

		const key = authenticatedUserCacheKey(claims);
		const kept = this.entries.get(key);
		if (kept) {
			if (kept.expiresAt > this.now()) {
				return cloneAuthenticatedUser(kept.user);
			}
			this.entries.delete(key);
		}

		let pending = this.loading.get(key);
		if (!pending) {
			const generation = this.generation;
			const lookup = load()
				.then((outcome) => {
					// Not kept when the cache was forgotten or cleared while the lookup ran: the context it
					// resolved may be the one that was invalidated.
					if (outcome && !(outcome instanceof UnauthorizedException) && generation === this.generation) {
						this.store(key, outcome);
					}
					return outcome;
				})
				.finally(() => {
					if (this.loading.get(key) === lookup) {
						this.loading.delete(key);
					}
				});
			pending = lookup;
			this.loading.set(key, pending);
		}

		const outcome = await pending;
		return outcome && !(outcome instanceof UnauthorizedException) ? cloneAuthenticatedUser(outcome) : outcome;
	}

	/**
	 * Drops the contexts of one user (every token of theirs, whatever employee or organization it names), so the
	 * next request of theirs is judged against the database. A lookup in flight is left to its own requests: no
	 * later request joins it, and what it resolves is not kept.
	 *
	 * @param userId The user.
	 */
	forget(userId: string): void {
		for (const [key, entry] of this.entries) {
			if (entry.user?.id === userId) {
				this.entries.delete(key);
			}
		}
		this.invalidatePending();
	}

	/** Drops every context, and keeps nothing a lookup in flight resolves. */
	clear(): void {
		this.entries.clear();
		this.invalidatePending();
	}

	/**
	 * Detaches every lookup in flight: a later request starts its own, and what the detached ones resolve is not
	 * kept. A pending lookup does not know which user it will resolve (a third-party token names none), so all of
	 * them are detached, whichever user is forgotten.
	 */
	private invalidatePending(): void {
		this.generation += 1;
		this.loading.clear();
	}

	/**
	 * Keeps a validated context, making room first when the cache is full: expired contexts go, then the oldest.
	 */
	private store(key: string, user: IAuthenticatedUser): void {
		if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
			this.evict();
		}
		this.entries.set(key, { user, expiresAt: this.now() + this.ttlMs });
	}

	private evict(): void {
		const now = this.now();
		for (const [key, entry] of this.entries) {
			if (entry.expiresAt <= now) {
				this.entries.delete(key);
			}
		}
		// Still full: the map iterates in insertion order, so the oldest contexts go first.
		while (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) {
				break;
			}
			this.entries.delete(oldest.value);
		}
	}
}

/**
 * Registers one {@link AuthenticatedUserCache} per process under the class token, so a module provides it and
 * `JwtStrategy` receives it. The class is not `@Injectable()`: Nest would otherwise try to resolve its options
 * parameter as a dependency, and fail to build the module.
 */
export const AuthenticatedUserCacheProvider: Provider = {
	provide: AuthenticatedUserCache,
	useFactory: () => new AuthenticatedUserCache()
};
