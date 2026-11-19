// Must stay first: loads the entity graph before the services pull an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import {
	EmbedAllowedOrigin,
	EmbedSiteGrant,
	Employee,
	Organization,
	Tenant,
	User,
	UserOrganization
} from '../core/entities/internal';
import { insertRow } from '../database/testing/insert-row';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { EmbedSiteGrantService } from './embed-site-grant.service';
import { generateEmbedRenewalToken } from './embed.utils';
import { TypeOrmEmbedAllowedOriginRepository } from './repository/type-orm-embed-allowed-origin.repository';
import { TypeOrmEmbedSiteGrantRepository } from './repository/type-orm-embed-site-grant.repository';

/**
 * A revocation and a renewal of one sign-in at the same moment, on PostgreSQL under READ COMMITTED, with real row locks:
 * the service on one connection, a raw transaction on another. SQLite runs one transaction at a time and cannot show it.
 *
 * - A rotation holds the spent token: the revocation's update covers that token, so it waits for the rotation's commit,
 *   then misses the successor the rotation stored; the successor's renewal finds the sign-in revoked and ends it.
 * - A revocation holds the sign-in's tokens: the renewal's update of the spent token waits for its commit, then finds
 *   the token revoked, and stores no successor.
 *
 * Runs when the entities are mapped for PostgreSQL and an empty, throwaway database is given (it builds the schema).
 * The suite builds the TypeORM repositories only, which the service uses when DB_ORM names TypeORM:
 *
 *   DB_TYPE=postgres DB_ORM=typeorm GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const TIMEOUT = 15 * 60 * 1000;
const WAIT_TIMEOUT = 30 * 1000;
const WAIT_STEP = 50;

/** The rows of the run. */
const TENANT = randomUUID();
const ORGANIZATION = randomUUID();
const USER = randomUUID();
const EMPLOYEE = randomUUID();
const SITE = 'https://team.northwind.example';
const DAY = 24 * 60 * 60 * 1000;

const ended = { status: 401, response: { code: 'EMBED_GRANT_ENDED' } };

const postgresUrl = process.env.GAUZY_MIGRATION_TEST_POSTGRES_URL;

(isPostgres() && postgresUrl ? describe : describe.skip)(
	'EmbedSiteGrantService on PostgreSQL: a revocation beside a renewal',
	() => {
		let dataSource: DataSource;
		let service: EmbedSiteGrantService;

		beforeAll(async () => {
			dataSource = new DataSource({
				type: 'postgres',
				url: postgresUrl,
				entities: coreEntities,
				logging: false,
				// Every statement of the spec at READ COMMITTED, PostgreSQL's default, whatever the database's own default.
				extra: { options: '-c default_transaction_isolation=read\\ committed' }
			});
			await dataSource.initialize();
			// The schema is built and the rows written only in a database that has no table yet.
			const [schema] = await dataSource.query(
				`SELECT COUNT(*)::int AS "tables" FROM information_schema.tables WHERE table_schema = current_schema()`
			);
			if (schema.tables > 0) {
				throw new Error('The spec builds a schema and writes rows: name an empty, throwaway database.');
			}
			await dataSource.synchronize();

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Northwind Studio' });
			await insertRow(dataSource, Organization, {
				id: ORGANIZATION,
				tenantId: TENANT,
				name: 'Northwind',
				currency: 'EUR'
			});
			await insertRow(dataSource, User, { id: USER, tenantId: TENANT, email: 'lina@northwind.example' });
			await insertRow(dataSource, Employee, {
				id: EMPLOYEE,
				...scope,
				userId: USER,
				isActive: true,
				isArchived: false,
				isTrackingEnabled: true
			});
			await insertRow(dataSource, UserOrganization, {
				...scope,
				userId: USER,
				isActive: true,
				isArchived: false
			});
			await insertRow(dataSource, EmbedAllowedOrigin, { ...scope, origin: SITE, allowPersonSignIn: true });

			service = new EmbedSiteGrantService(
				new TypeOrmEmbedSiteGrantRepository(dataSource.getRepository(EmbedSiteGrant)),
				new TypeOrmEmployeeRepository(dataSource.getRepository(Employee)),
				{} as never,
				new TypeOrmUserOrganizationRepository(dataSource.getRepository(UserOrganization)),
				{} as never,
				{ issueEmbedSession: async () => 'a-timer-token' } as never,
				new EmbedAllowedOriginService(
					new TypeOrmEmbedAllowedOriginRepository(dataSource.getRepository(EmbedAllowedOrigin)),
					{} as never
				)
			);
		}, TIMEOUT);

		afterAll(async () => {
			await dataSource?.destroy();
		});

		/** A row of a renewal token of Lina's sign-in from the site, stored as the service stores one. */
		const tokenRow = (familyId: string, keyHash: string) => ({
			id: randomUUID(),
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			userId: USER,
			employeeId: EMPLOYEE,
			origin: SITE,
			familyId,
			keyHash,
			expiresAt: new Date(Date.now() + DAY)
		});

		/** A sign-in of one renewal token: the token, its row and its sign-in. */
		const signIn = async () => {
			const { token, keyHash } = generateEmbedRenewalToken();
			const row = tokenRow(randomUUID(), keyHash);
			await insertRow(dataSource, EmbedSiteGrant, row);
			return { token, row };
		};

		const rowsOf = async (familyId: string) =>
			(await dataSource.query(
				`SELECT "keyHash", "usedAt", "revokedAt" FROM "embed_site_grant" WHERE "familyId" = $1`,
				[familyId]
			)) as Array<{ keyHash: string; usedAt: Date | null; revokedAt: Date | null }>;

		/** A call of the service, and whether it has answered yet. */
		const track = <T>(promise: Promise<T>) => {
			const call = { promise, settled: false };
			const settle = () => {
				call.settled = true;
			};
			promise.then(settle, settle);
			return call;
		};

		/** The server process of a connection of the spec. */
		const backendOf = async (runner: QueryRunner): Promise<number> => {
			const [row] = await runner.query(`SELECT pg_backend_pid() AS "pid"`);
			return row.pid;
		};

		/** Resolves once a statement waits for a lock the given connection's transaction holds. */
		const untilBlockedBy = async (blocker: number): Promise<void> => {
			const deadline = Date.now() + WAIT_TIMEOUT;
			for (;;) {
				const [row] = await dataSource.query(
					`SELECT COUNT(*)::int AS "count" FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
					[blocker]
				);
				if (row.count > 0) {
					return;
				}
				if (Date.now() > deadline) {
					throw new Error('No statement waited for a lock of the spec transaction');
				}
				await new Promise((resolve) => setTimeout(resolve, WAIT_STEP));
			}
		};

		const pause = () => new Promise((resolve) => setTimeout(resolve, 300));

		it(
			'makes a revocation wait for a rotation holding the spent token; the successor it missed is refused',
			async () => {
				const { token, row } = await signIn();
				const successor = generateEmbedRenewalToken();
				const rotation = dataSource.createQueryRunner();
				await rotation.connect();
				await rotation.startTransaction();
				try {
					// The rotation's own update: it holds the spent token's row until it commits.
					await rotation.query(
						`UPDATE "embed_site_grant" SET "usedAt" = now() WHERE "id" = $1 AND "usedAt" IS NULL AND "revokedAt" IS NULL`,
						[row.id]
					);
					const revocation = track(service.revoke({ renewalToken: token }));

					await untilBlockedBy(await backendOf(rotation));
					await pause();
					expect(revocation.settled).toBe(false);

					await rotation.manager.insert(EmbedSiteGrant, tokenRow(row.familyId, successor.keyHash));
					await rotation.commitTransaction();
					await revocation.promise;
				} finally {
					if (rotation.isTransactionActive) {
						await rotation.rollbackTransaction();
					}
					await rotation.release();
				}

				// The revocation's update ran from a snapshot taken before the successor was stored.
				const missed = (await rowsOf(row.familyId)).find((stored) => stored.keyHash === successor.keyHash);
				expect(missed.revokedAt).toBeNull();

				await expect(service.renew({ renewalToken: successor.token }, SITE)).rejects.toMatchObject(ended);

				const rows = await rowsOf(row.familyId);
				expect(rows).toHaveLength(2);
				expect(rows.every((stored) => stored.revokedAt !== null)).toBe(true);
			},
			TIMEOUT
		);

		it(
			'makes a renewal wait for a revocation holding the sign-in, then refuses it and stores no successor',
			async () => {
				const { token, row } = await signIn();
				const revocation = dataSource.createQueryRunner();
				await revocation.connect();
				await revocation.startTransaction();
				try {
					// The revocation's own update: it holds the row of every token of the sign-in until it commits.
					await revocation.query(
						`UPDATE "embed_site_grant" SET "revokedAt" = now() WHERE "familyId" = $1 AND "revokedAt" IS NULL`,
						[row.familyId]
					);
					const renewal = track(service.renew({ renewalToken: token }, SITE));

					await untilBlockedBy(await backendOf(revocation));
					await pause();
					expect(renewal.settled).toBe(false);

					await revocation.commitTransaction();
					await expect(renewal.promise).rejects.toMatchObject(ended);
				} finally {
					if (revocation.isTransactionActive) {
						await revocation.rollbackTransaction();
					}
					await revocation.release();
				}

				const rows = await rowsOf(row.familyId);
				expect(rows).toHaveLength(1);
				expect(rows[0].revokedAt).not.toBeNull();
			},
			TIMEOUT
		);
	}
);
