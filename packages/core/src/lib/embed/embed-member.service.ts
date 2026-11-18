import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID } from '@gauzy/contracts';

/** How long a MySQL server waits for another exchange that adds the same person, in seconds. */
const MYSQL_TURN_WAIT_SECONDS = 10;

/** The answer to an exchange that waited too long for another one adding the same person. */
export const EMBED_MEMBER_ADDITION_BUSY_MESSAGE =
	'This person is being added by another request. Try again in a moment.';

/**
 * The name of the turn of one address of a tenant, for this process and for the database's lock: a digest, never the
 * address itself. The address counts in lower case, as the exchange finds a member by it in either case.
 */
function turnNameOf(tenantId: ID, email: string): string {
	const address = email.trim().toLowerCase();
	const digest = createHash('sha256').update(`${tenantId}:${address}`).digest('hex');
	return `gauzy:embed-member:${digest.slice(0, 32)}`;
}

/**
 * Adds the people embed exchanges name as employees of a credential's organization, for a credential that may add
 * members (`canAddMembers`).
 */
@Injectable()
export class EmbedMemberService {
	/** The turns running in this process, by name: each one waits for the one before it to end. */
	private readonly turns = new Map<string, Promise<void>>();

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Runs `work` alone for an address of a tenant, so that two exchanges that would add the same person run one after
	 * the other and the second finds the member the first added. Nothing in the database stops a second account of an
	 * address, or a second employee of an account in an organization.
	 *
	 * - in this process, the turns of one address run in the order they were asked for;
	 * - Postgres: a transaction-scoped advisory lock, held by a connection of its own, which the other API processes
	 *   wait for too;
	 * - MySQL: a named lock (`GET_LOCK`) held by a connection of its own; an exchange that waits for it longer than
	 *   {@link MYSQL_TURN_WAIT_SECONDS} gets a 503;
	 * - SQLite: the process's own order (it runs a single API process).
	 *
	 * @param tenantId The credential's tenant.
	 * @param email The address, as the exchange names it.
	 * @param work What runs alone.
	 */
	async inTurn<T>(tenantId: ID, email: string, work: () => Promise<T>): Promise<T> {
		const name = turnNameOf(tenantId, email);
		const previous = this.turns.get(name) ?? Promise.resolve();
		let end: () => void = () => undefined;
		const ended = new Promise<void>((resolve) => {
			end = resolve;
		});
		const last = previous.then(() => ended);
		this.turns.set(name, last);
		try {
			await previous;
			return await this.underDatabaseLock(name, work);
		} finally {
			end();
			if (this.turns.get(name) === last) {
				this.turns.delete(name);
			}
		}
	}

	/** `work` under the database's lock of the name, where the database has one. */
	private async underDatabaseLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const type = this.dataSource.options.type;
		if (type === 'postgres') {
			return await this.underPostgresLock(name, work);
		}
		if (type === 'mysql') {
			return await this.underMysqlLock(name, work);
		}
		return await work();
	}

	/**
	 * `work` while a transaction of a connection of its own holds the advisory lock; ending the transaction releases
	 * it. The work writes on other connections, so what it wrote is committed before the next holder reads.
	 */
	private async underPostgresLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			await runner.startTransaction();
			try {
				await runner.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [name]);
				const result = await work();
				await runner.commitTransaction();
				return result;
			} catch (error) {
				if (runner.isTransactionActive) {
					await runner.rollbackTransaction();
				}
				throw error;
			}
		} finally {
			await runner.release();
		}
	}

	/** `work` while a connection of its own holds the named lock, which it releases after. */
	private async underMysqlLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			const [row] = await runner.query('SELECT GET_LOCK(?, ?) AS `acquired`', [name, MYSQL_TURN_WAIT_SECONDS]);
			const isAcquired = Number(row?.acquired) === 1;
			if (!isAcquired) {
				throw new ServiceUnavailableException(EMBED_MEMBER_ADDITION_BUSY_MESSAGE);
			}
			try {
				return await work();
			} finally {
				await runner.query('SELECT RELEASE_LOCK(?)', [name]);
			}
		} finally {
			await runner.release();
		}
	}
}
