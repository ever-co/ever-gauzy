import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createPrivateKey, randomUUID, sign as edSign } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EVER_INSTANCE_ROW_ID, EVER_INSTANCE_TABLE as TABLE } from './ever-instance.constants';
import {
	connectKeyMaterialProblem,
	ConnectKeyMaterialProblem,
	EverInstanceKeyError,
	generateEd25519KeyPair,
	keyIdOf,
	KeyMaterialSource,
	keyWarning,
	KeyWarning,
	preferredKeySource,
	signBytes,
	storedKeySource,
	unwrapKey,
	wrapKey
} from './ever-instance-key';
import { EverInstanceEvents } from './ever-instance.events';
import { dialectOf, insertIgnore, placeholder as ph, quote, runSql, SqlDialect, toBool, toNumber } from './sql';

/** Injection token for the environment the identity reads (tests pass their own; default `process.env`). */
export const EVER_INSTANCE_ENV = 'EVER_INSTANCE_ENV';

/** The identity of this installation, as other modules see it. Holds no private key. */
export interface EverInstanceRecord {
	instanceId: string;
	statsPublicKey: string;
	statsKeyId: string;
	/** Which secret protects the stored statistics key (`k` ENCRYPTION_KEY, `j` JWT_SECRET, `n` none). */
	statsKeySource: KeyMaterialSource | null;
	operatorUserId: string | null;
	statsEnabledUi: boolean;
	resetCount: number;
	createdAt: number;
	updatedAt: number;
}

/** Signs statistics reports with the statistics key. The private key itself is never exposed. */
export interface EverStatsSigner {
	/** Base64url, 43 characters. */
	readonly publicKey: string;
	/** Base64url of the first 8 bytes of SHA-256 over the public key, 11 characters. */
	readonly keyId: string;
	/** The 64-byte Ed25519 signature of exactly `bytes`. */
	sign(bytes: Uint8Array): Buffer;
	/** Overwrites the private key held by this signer; it cannot sign afterwards. */
	dispose(): void;
}

/** The statistics identity a signer must belong to (see {@link EverInstanceService.statsSigner}). */
export interface ExpectedStatsIdentity {
	instanceId: string;
	statsKeyId: string;
}

/** The Ever Platform connect key as other modules see it: its public part only. */
export interface EverConnectKeyRecord {
	/** Base64url, 43 characters (`public_jwk.x`). */
	publicKey: string;
	/** Base64url of the first 8 bytes of SHA-256 over the public key, 11 characters. */
	keyId: string;
}

/**
 * Signs with the Ever Platform connect key (the shape the Ever Platform SDK's client takes). The
 * private key itself is never exposed; JSON and inspection show the key id only.
 */
export interface EverConnectSigner {
	readonly kid: string;
	/** The raw 32-byte public key. */
	readonly publicKeyRaw: Uint8Array;
	sign(bytes: Uint8Array): Promise<Uint8Array>;
}

/**
 * The connect key cannot be stored safely with the secrets of this process: neither
 * `ENCRYPTION_KEY` nor a `JWT_SECRET` other than a published default is set.
 */
export class EverConnectKeyMaterialError extends Error {
	constructor(readonly code: ConnectKeyMaterialProblem) {
		super('Set ENCRYPTION_KEY (or a strong, unique JWT_SECRET) before connecting this installation to Ever Platform.');
		this.name = 'EverConnectKeyMaterialError';
	}
}

/** The identity changed (a reset by another request or process) between two reads. */
export class EverInstanceIdentityChangedError extends Error {
	constructor() {
		super('The identity of this installation changed while a report was being prepared.');
		this.name = 'EverInstanceIdentityChangedError';
	}
}

/** The order of protection of a stored key: the fixed value, then JWT_SECRET, then ENCRYPTION_KEY. */
const SOURCE_RANK: Readonly<Record<KeyMaterialSource, number>> = Object.freeze({ n: 0, j: 1, k: 2 });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Creates, reads and changes the single `ever_instance` row.
 *
 * `ensure()` is safe when several API processes boot at once on one database: each tries an insert
 * that does nothing when the row exists, then reads the row back, so all of them end up with the same
 * id and key. The statistics private key is stored encrypted and only ever leaves this service as
 * a signature.
 */
@Injectable()
export class EverInstanceService {
	private readonly logger = new Logger('EverInstance');
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly events: EverInstanceEvents,
		@Optional() @Inject(EVER_INSTANCE_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	private get dialect(): SqlDialect {
		return dialectOf(this.dataSource);
	}

	private col(name: string): string {
		return quote(this.dialect, name);
	}

	/**
	 * Returns the identity of this installation, creating it on first call. When a stronger secret
	 * than the one the stored key is protected by has since been set (`JWT_SECRET` over the fixed
	 * value, `ENCRYPTION_KEY` over both), the key is stored again under it.
	 */
	async ensure(): Promise<EverInstanceRecord> {
		const existing = await this.readRow();
		if (existing) {
			await this.protectWithPreferredSource(existing);
			return this.toRecord((await this.readRow()) ?? existing);
		}
		const { publicKey, privateKeyDer } = generateEd25519KeyPair();
		const now = Date.now();
		const values: Record<string, unknown> = {
			id: EVER_INSTANCE_ROW_ID,
			instanceId: this.initialInstanceId(),
			statsPublicKey: publicKey,
			statsPrivateKeyEncrypted: wrapKey(privateKeyDer, 'stats', this.env),
			statsKeyId: keyIdOf(publicKey),
			statsEnabledUi: true,
			resetCount: 0,
			createdAt: now,
			updatedAt: now
		};
		privateKeyDer.fill(0);
		const columns = Object.keys(values);
		await runSql(this.dataSource, insertIgnore(this.dialect, TABLE, columns), Object.values(values));
		const row = await this.readRow();
		if (!row) {
			throw new Error('The ever_instance row could not be created.');
		}
		return this.toRecord(row);
	}

	/** The identity, or `null` before `ensure()` ran. */
	async get(): Promise<EverInstanceRecord | null> {
		const row = await this.readRow();
		return row ? this.toRecord(row) : null;
	}

	/**
	 * A signer over the statistics key. Throws {@link EverInstanceKeyError} when the stored key cannot
	 * be read with the secrets of this process (it then fails closed: nothing can be signed).
	 *
	 * With `expected`, the key is read only when the stored identity is still that one; otherwise it
	 * throws {@link EverInstanceIdentityChangedError}, so a report built for one identity is never
	 * signed with the key of the next one (a *Reset instance identity* in between).
	 */
	async statsSigner(expected?: ExpectedStatsIdentity): Promise<EverStatsSigner> {
		const row = await this.readRow();
		if (!row) {
			throw new Error('The identity of this installation does not exist yet.');
		}
		if (expected && (String(row['instanceId']) !== expected.instanceId || String(row['statsKeyId']) !== expected.statsKeyId)) {
			throw new EverInstanceIdentityChangedError();
		}
		const privateKeyDer = unwrapKey(String(row['statsPrivateKeyEncrypted']), 'stats', this.env);
		const publicKey = String(row['statsPublicKey']);
		const keyId = String(row['statsKeyId']);
		const signer: EverStatsSigner = {
			publicKey,
			keyId,
			sign: (bytes: Uint8Array) => signBytes(privateKeyDer, bytes),
			dispose: () => {
				privateKeyDer.fill(0);
			}
		};
		// Neither JSON nor inspection shows more than the public key.
		Object.defineProperty(signer, 'toJSON', { value: () => ({ publicKey, keyId }), enumerable: false });
		return signer;
	}

	/** Whether the stored statistics key can be read with the secrets of this process. */
	async statsKeyReadable(): Promise<boolean> {
		const row = await this.readRow();
		if (!row) {
			return false;
		}
		try {
			unwrapKey(String(row['statsPrivateKeyEncrypted']), 'stats', this.env).fill(0);
			return true;
		} catch (error) {
			if (error instanceof EverInstanceKeyError) {
				return false;
			}
			throw error;
		}
	}

	/** The public part of the Ever Platform connect key, or `null` before one was made. */
	async connectKey(): Promise<EverConnectKeyRecord | null> {
		const row = await this.readRow();
		if (!row?.['connectPublicKey'] || !row['connectPrivateKeyEncrypted']) {
			return null;
		}
		return { publicKey: String(row['connectPublicKey']), keyId: String(row['connectKeyId']) };
	}

	/**
	 * The Ever Platform connect key, made on first use: a second Ed25519 key pair, separate from the
	 * statistics key, so resetting the statistics identity never touches the connection and the
	 * connection never signs a statistics report. Refuses ({@link EverConnectKeyMaterialError})
	 * unless `ENCRYPTION_KEY` or a `JWT_SECRET` other than a published default is set. Safe when
	 * several processes call it at once: only the first write is kept (compare and set on an empty key).
	 */
	async ensureConnectKey(): Promise<EverConnectKeyRecord> {
		const problem = connectKeyMaterialProblem(this.env);
		if (problem) {
			throw new EverConnectKeyMaterialError(problem);
		}
		await this.ensure();
		const existing = await this.connectKey();
		if (existing) {
			return existing;
		}
		const { publicKey, privateKeyDer } = generateEd25519KeyPair();
		const wrapped = wrapKey(privateKeyDer, 'connect', this.env);
		privateKeyDer.fill(0);
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('connectPublicKey')} = ${ph(d, 1)}, ${this.col('connectPrivateKeyEncrypted')} = ${ph(d, 2)}, ${this.col('connectKeyId')} = ${ph(d, 3)}, ${this.col('updatedAt')} = ${ph(d, 4)} ` +
				`WHERE ${this.col('id')} = ${ph(d, 5)} AND ${this.col('connectPublicKey')} IS NULL`,
			[publicKey, wrapped, keyIdOf(publicKey), Date.now(), EVER_INSTANCE_ROW_ID]
		);
		const stored = await this.connectKey();
		if (!stored) {
			throw new Error('The connect key of this installation could not be stored.');
		}
		return stored;
	}

	/**
	 * A signer over the connect key, or `null` when there is none. Throws
	 * {@link EverInstanceKeyError} when the stored key cannot be read with the secrets of this
	 * process (it fails closed: nothing can be signed).
	 */
	async connectSigner(): Promise<EverConnectSigner | null> {
		const row = await this.readRow();
		if (!row?.['connectPrivateKeyEncrypted'] || !row['connectPublicKey']) {
			return null;
		}
		const der = unwrapKey(String(row['connectPrivateKeyEncrypted']), 'connect', this.env);
		const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
		der.fill(0);
		const kid = String(row['connectKeyId']);
		const signer: EverConnectSigner = {
			kid,
			publicKeyRaw: new Uint8Array(Buffer.from(String(row['connectPublicKey']), 'base64url')),
			sign: async (bytes: Uint8Array) => new Uint8Array(edSign(null, bytes, privateKey))
		};
		// Neither JSON nor inspection shows more than the key id.
		Object.defineProperty(signer, 'toJSON', { value: () => ({ kid }), enumerable: false });
		Object.defineProperty(signer, 'toString', { value: () => `EverConnectSigner(${kid})`, enumerable: false });
		return signer;
	}

	/**
	 * Forgets the connect key. Ever Platform never accepts a revoked key again, so after a revocation
	 * the next connect makes a new one. The statistics key is not touched.
	 */
	async dropConnectKey(): Promise<void> {
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('connectPublicKey')} = NULL, ${this.col('connectPrivateKeyEncrypted')} = NULL, ${this.col('connectKeyId')} = NULL, ${this.col('updatedAt')} = ${ph(d, 1)} WHERE ${this.col('id')} = ${ph(d, 2)}`,
			[Date.now(), EVER_INSTANCE_ROW_ID]
		);
	}

	/** Ever Platform's key manifest as last fetched (it is verified again whenever it is read), and when. */
	async jwksCache(): Promise<{ json: string | null; fetchedAt: number | null }> {
		const row = await this.readRow();
		return { json: row?.['jwksCache'] ? String(row['jwksCache']) : null, fetchedAt: toNumber(row?.['jwksFetchedAt']) };
	}

	/** Stores Ever Platform's key manifest (`null` forgets it). */
	async setJwksCache(json: string | null): Promise<void> {
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('jwksCache')} = ${ph(d, 1)}, ${this.col('jwksFetchedAt')} = ${ph(d, 2)}, ${this.col('updatedAt')} = ${ph(d, 3)} WHERE ${this.col('id')} = ${ph(d, 4)}`,
			[json, json === null ? null : Date.now(), Date.now(), EVER_INSTANCE_ROW_ID]
		);
	}

	/**
	 * The warning the settings page shows while the stored key is not protected by `ENCRYPTION_KEY`,
	 * built from how it is stored (`stored`, see {@link EverInstanceRecord.statsKeySource}).
	 */
	keyWarning(stored?: KeyMaterialSource | null): KeyWarning | null {
		return keyWarning(this.env, stored);
	}

	/** The operator switches the anonymous statistics on or off. */
	async setStatsEnabledUi(enabled: boolean, actorId: string | null): Promise<EverInstanceRecord> {
		const before = await this.ensure();
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('statsEnabledUi')} = ${ph(d, 1)}, ${this.col('updatedAt')} = ${ph(d, 2)} WHERE ${this.col('id')} = ${ph(d, 3)}`,
			[enabled, Date.now(), EVER_INSTANCE_ROW_ID]
		);
		const after = (await this.get()) as EverInstanceRecord;
		if (before.statsEnabledUi !== after.statsEnabledUi) {
			const at = Date.now();
			this.events.emit({ type: 'ever.instance.stats_toggle', actorId, from: before.statsEnabledUi, to: after.statsEnabledUi, at });
			this.audit({ action: 'stats.toggle', actor_id: actorId, from: before.statsEnabledUi, to: after.statsEnabledUi });
		}
		return after;
	}

	/**
	 * "Reset instance identity": a new statistics id and a new statistics key. The next report is the
	 * first of a new installation for Ever Platform. The Ever Platform connection (`connect*`) is not
	 * touched.
	 */
	async resetIdentity(actorId: string | null): Promise<EverInstanceRecord> {
		await this.ensure();
		const { publicKey, privateKeyDer } = generateEd25519KeyPair();
		const wrapped = wrapKey(privateKeyDer, 'stats', this.env);
		privateKeyDer.fill(0);
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('instanceId')} = ${ph(d, 1)}, ${this.col('statsPublicKey')} = ${ph(d, 2)}, ${this.col('statsPrivateKeyEncrypted')} = ${ph(d, 3)}, ${this.col('statsKeyId')} = ${ph(d, 4)}, ${this.col('resetCount')} = ${this.col('resetCount')} + 1, ${this.col('updatedAt')} = ${ph(d, 5)} WHERE ${this.col('id')} = ${ph(d, 6)}`,
			[randomUUID(), publicKey, wrapped, keyIdOf(publicKey), Date.now(), EVER_INSTANCE_ROW_ID]
		);
		const after = (await this.get()) as EverInstanceRecord;
		this.events.emit({ type: 'ever.instance.reset', actorId, resetCount: after.resetCount, at: Date.now() });
		this.audit({ action: 'instance.reset_identity', actor_id: actorId, reset_count: after.resetCount });
		return after;
	}

	/**
	 * Pins `userId` as the operator of a single-tenant installation, once: it only writes while no
	 * operator is pinned. Returns the operator pinned afterwards (this user or an earlier one).
	 */
	async pinOperator(userId: string): Promise<string | null> {
		await this.ensure();
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('operatorUserId')} = ${ph(d, 1)}, ${this.col('updatedAt')} = ${ph(d, 2)} WHERE ${this.col('id')} = ${ph(d, 3)} AND ${this.col('operatorUserId')} IS NULL`,
			[userId, Date.now(), EVER_INSTANCE_ROW_ID]
		);
		return (await this.get())?.operatorUserId ?? null;
	}

	/**
	 * Replaces a pinned operator who can no longer be one (deleted, deactivated or no longer a super
	 * admin) by `next`, only while `stale` is still the pinned one (compare and set), and writes one
	 * audit line with both user ids. Returns the operator pinned afterwards.
	 */
	async repinOperator(stale: string, next: string | null): Promise<string | null> {
		await this.ensure();
		const d = this.dialect;
		const { affected } = await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('operatorUserId')} = ${ph(d, 1)}, ${this.col('updatedAt')} = ${ph(d, 2)} WHERE ${this.col('id')} = ${ph(d, 3)} AND ${this.col('operatorUserId')} = ${ph(d, 4)}`,
			[next, Date.now(), EVER_INSTANCE_ROW_ID, stale]
		);
		if (affected === 1) {
			this.audit({ action: 'operator.repin', actor_id: null, from: stale, to: next });
		}
		return (await this.get())?.operatorUserId ?? null;
	}

	private initialInstanceId(): string {
		const fixed = this.env['EVER_INSTANCE_ID']?.trim().toLowerCase();
		if (fixed) {
			if (UUID_V4.test(fixed)) {
				return fixed;
			}
			this.logger.warn('EVER_INSTANCE_ID is not a UUID v4; a random id is used.');
		}
		return randomUUID();
	}

	/**
	 * Stores the key again under a stronger secret once one is set (the fixed value → `JWT_SECRET` →
	 * `ENCRYPTION_KEY`), only when the old secret still reads it.
	 */
	private async protectWithPreferredSource(row: Record<string, unknown>): Promise<void> {
		await this.protectAgain(row, 'statsPrivateKeyEncrypted', 'stats');
		if (row['connectPrivateKeyEncrypted']) {
			await this.protectAgain(row, 'connectPrivateKeyEncrypted', 'connect');
		}
	}

	private async protectAgain(row: Record<string, unknown>, column: string, purpose: 'stats' | 'connect'): Promise<void> {
		const blob = String(row[column] ?? '');
		const current = storedKeySource(blob);
		const preferred = preferredKeySource(this.env);
		if (!current || SOURCE_RANK[preferred] <= SOURCE_RANK[current]) {
			return;
		}
		let plain: Buffer;
		try {
			plain = unwrapKey(blob, purpose, this.env);
		} catch (error) {
			if (error instanceof EverInstanceKeyError) {
				return;
			}
			throw error;
		}
		const rewrapped = wrapKey(plain, purpose, this.env);
		plain.fill(0);
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col(column)} = ${ph(d, 1)}, ${this.col('updatedAt')} = ${ph(d, 2)} WHERE ${this.col('id')} = ${ph(d, 3)} AND ${this.col(column)} = ${ph(d, 4)}`,
			[rewrapped, Date.now(), EVER_INSTANCE_ROW_ID, blob]
		);
		this.logger.log(
			`The ${purpose === 'stats' ? 'statistics' : 'Ever Platform connect'} key of this installation is now protected by ${preferred === 'k' ? 'ENCRYPTION_KEY' : 'JWT_SECRET'}.`
		);
	}

	private async readRow(): Promise<Record<string, unknown> | null> {
		const d = this.dialect;
		const { rows } = await runSql(this.dataSource, `SELECT * FROM ${quote(d, TABLE)} WHERE ${this.col('id')} = ${ph(d, 1)}`, [
			EVER_INSTANCE_ROW_ID
		]);
		return rows[0] ?? null;
	}

	private toRecord(row: Record<string, unknown>): EverInstanceRecord {
		return {
			instanceId: String(row['instanceId']),
			statsPublicKey: String(row['statsPublicKey']),
			statsKeyId: String(row['statsKeyId']),
			statsKeySource: storedKeySource(String(row['statsPrivateKeyEncrypted'] ?? '')),
			operatorUserId: row['operatorUserId'] ? String(row['operatorUserId']) : null,
			statsEnabledUi: toBool(row['statsEnabledUi']),
			resetCount: toNumber(row['resetCount']) ?? 0,
			createdAt: toNumber(row['createdAt']) ?? 0,
			updatedAt: toNumber(row['updatedAt']) ?? 0
		};
	}

	/** One structured audit line: the action, the actor id and the change. Never a secret, an address or a key. */
	private audit(entry: Record<string, unknown>): void {
		this.logger.log(JSON.stringify({ audit: 'ever_instance', ...entry }));
	}
}
