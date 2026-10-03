import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EVER_INSTANCE_ROW_ID, EVER_INSTANCE_TABLE as TABLE } from './ever-instance.constants';
import {
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
}

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
	 * Returns the identity of this installation, creating it on first call. When the stored key is
	 * protected by `JWT_SECRET` (or nothing) and `ENCRYPTION_KEY` has since been set, it is stored
	 * again under `ENCRYPTION_KEY`.
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
	 */
	async statsSigner(): Promise<EverStatsSigner> {
		const row = await this.readRow();
		if (!row) {
			throw new Error('The identity of this installation does not exist yet.');
		}
		const privateKeyDer = unwrapKey(String(row['statsPrivateKeyEncrypted']), 'stats', this.env);
		const publicKey = String(row['statsPublicKey']);
		const keyId = String(row['statsKeyId']);
		const signer: EverStatsSigner = {
			publicKey,
			keyId,
			sign: (bytes: Uint8Array) => signBytes(privateKeyDer, bytes)
		};
		// Neither JSON nor inspection shows more than the public key.
		Object.defineProperty(signer, 'toJSON', { value: () => ({ publicKey, keyId }), enumerable: false });
		return signer;
	}

	/** The warning the settings page shows while the stored keys are not protected by `ENCRYPTION_KEY`. */
	keyWarning(): KeyWarning | null {
		return keyWarning(this.env);
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

	/** Stores the key again under `ENCRYPTION_KEY` once it is set (only when the old secret still reads it). */
	private async protectWithPreferredSource(row: Record<string, unknown>): Promise<void> {
		const blob = String(row['statsPrivateKeyEncrypted'] ?? '');
		const current = storedKeySource(blob);
		const preferred = preferredKeySource(this.env);
		if (!current || current === preferred || preferred !== 'k') {
			return;
		}
		let plain: Buffer;
		try {
			plain = unwrapKey(blob, 'stats', this.env);
		} catch (error) {
			if (error instanceof EverInstanceKeyError) {
				return;
			}
			throw error;
		}
		const rewrapped = wrapKey(plain, 'stats', this.env);
		plain.fill(0);
		const d = this.dialect;
		await runSql(
			this.dataSource,
			`UPDATE ${quote(d, TABLE)} SET ${this.col('statsPrivateKeyEncrypted')} = ${ph(d, 1)}, ${this.col('updatedAt')} = ${ph(d, 2)} WHERE ${this.col('id')} = ${ph(d, 3)} AND ${this.col('statsPrivateKeyEncrypted')} = ${ph(d, 4)}`,
			[rewrapped, Date.now(), EVER_INSTANCE_ROW_ID, blob]
		);
		this.logger.log('The statistics key of this installation is now protected by ENCRYPTION_KEY.');
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
