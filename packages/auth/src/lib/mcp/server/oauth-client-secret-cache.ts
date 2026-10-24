/**
 * Client secrets recently verified with bcrypt, so a client that authenticates on every request (the MCP server at
 * the introspection endpoint) is not charged a cost-12 bcrypt comparison each time.
 */

import * as crypto from 'crypto';

/** How long a verified secret is taken as right without bcrypt. Counted from the verification, never extended. */
export const VERIFIED_CLIENT_SECRET_TTL_MS = 5 * 60 * 1000;

/** How many verified secrets are kept at most (one per client); past it the least recently used is forgotten. */
export const MAX_VERIFIED_CLIENT_SECRETS = 1000;

interface VerifiedClientSecret {
	/** HMAC-SHA-256 of the secret under this cache's own key: the secret itself is never kept */
	digest: Buffer;
	/** The stored bcrypt hash the secret was verified against: a different stored hash means the secret changed */
	secretHash: string;
	expiresAt: number;
}

/**
 * Remembers, per client, the secret last verified against the client's stored bcrypt hash.
 *
 * - Only a successful verification is remembered. A wrong secret always costs a bcrypt comparison, so guessing a
 *   secret is no cheaper, and it never displaces the right secret already remembered.
 * - A remembered secret counts only against the same stored hash (a rotated secret is verified again) and only for
 *   {@link VERIFIED_CLIENT_SECRET_TTL_MS} after it was verified.
 * - The presented secret's digest is compared with the remembered one in constant time.
 * - Concurrent verifications of the same secret against the same hash share one bcrypt comparison, so an expired
 *   entry does not send every request in flight to bcrypt at once.
 *
 * The caller checks that the client exists and is active before asking, and calls {@link forget} when a client is
 * removed, so a disabled or deleted client never authenticates from this cache.
 */
export class VerifiedClientSecretCache {
	private readonly entries = new Map<string, VerifiedClientSecret>();
	private readonly pending = new Map<string, Promise<boolean>>();
	// Made per process and never exported: a remembered digest is no use without it
	private readonly key = crypto.randomBytes(32);

	/**
	 * @param ttlMs - How long a verified secret is remembered.
	 * @param maxEntries - How many clients' secrets are remembered at most.
	 * @param now - The clock, in milliseconds.
	 */
	constructor(
		private readonly ttlMs = VERIFIED_CLIENT_SECRET_TTL_MS,
		private readonly maxEntries = MAX_VERIFIED_CLIENT_SECRETS,
		private readonly now: () => number = Date.now
	) {}

	/**
	 * Whether `secret` is the client's secret: answered from the cache when this secret was verified against
	 * `secretHash` within the TTL, otherwise by `compare` (bcrypt), whose success is then remembered.
	 *
	 * @param clientId - The client authenticating; it must exist and be active.
	 * @param secret - The secret it presented.
	 * @param secretHash - The client's stored bcrypt hash.
	 * @param compare - The comparison to run when the cache cannot answer.
	 */
	async verify(
		clientId: string,
		secret: string,
		secretHash: string,
		compare: (secret: string, secretHash: string) => Promise<boolean>
	): Promise<boolean> {
		const digest = this.digest(secret);
		if (this.isRemembered(clientId, digest, secretHash)) {
			return true;
		}

		const key = `${clientId}\n${secretHash}\n${digest.toString('hex')}`;
		let pending = this.pending.get(key);
		if (!pending) {
			pending = compare(secret, secretHash)
				.then((valid) => {
					if (valid) {
						this.remember(clientId, digest, secretHash);
					}
					return valid;
				})
				.finally(() => this.pending.delete(key));
			this.pending.set(key, pending);
		}
		return pending;
	}

	/** Forgets the client's verified secret (the client was removed or disabled) */
	forget(clientId: string): void {
		this.entries.delete(clientId);
	}

	/** How many clients' secrets are remembered */
	get size(): number {
		return this.entries.size;
	}

	private isRemembered(clientId: string, digest: Buffer, secretHash: string): boolean {
		const entry = this.entries.get(clientId);
		if (!entry) {
			return false;
		}
		if (entry.expiresAt <= this.now() || entry.secretHash !== secretHash) {
			this.entries.delete(clientId);
			return false;
		}
		// Both digests are 32 bytes. A different secret keeps the entry: it may not displace the right one.
		if (!crypto.timingSafeEqual(entry.digest, digest)) {
			return false;
		}
		// Re-inserted last: the most recently used
		this.entries.delete(clientId);
		this.entries.set(clientId, entry);
		return true;
	}

	private remember(clientId: string, digest: Buffer, secretHash: string): void {
		this.entries.delete(clientId);
		while (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) {
				break;
			}
			this.entries.delete(oldest.value);
		}
		this.entries.set(clientId, { digest, secretHash, expiresAt: this.now() + this.ttlMs });
	}

	private digest(secret: string): Buffer {
		return crypto.createHmac('sha256', this.key).update(secret, 'utf8').digest();
	}
}
