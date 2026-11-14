/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `user.email-lookup.spec.ts` for the cycle it avoids).
 */
import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { knex, Knex } from 'knex';
import { DataSource, EntitySchema } from 'typeorm';
import { MultiORMEnum } from '../core/utils';
import { AuthService } from './auth.service';

/**
 * The teams a sign-in lists (`current_teams` of the workspace pick) leave out a soft-deleted team, a team of a
 * soft-deleted organization included (ever-co/ever-gauzy#11960), under both ORMs. The TypeORM query builder leaves
 * deleted teams out on its own; the MikroORM branch reads through raw knex, which skips the soft-delete filter.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'org-1';
const USER = 'user-1';
const EMPLOYEE = 'employee-1';

const flags = {
	tenantId: { type: 'varchar' },
	organizationId: { type: 'varchar' },
	isActive: { type: 'boolean', default: true },
	isArchived: { type: 'boolean', default: false },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
} as const;

const schemas = [
	new EntitySchema({
		name: 'organization_team',
		columns: {
			id: { type: 'varchar', primary: true },
			name: { type: 'varchar' },
			logo: { type: 'varchar', nullable: true },
			profile_link: { type: 'varchar', nullable: true },
			prefix: { type: 'varchar', nullable: true },
			createdAt: { type: 'datetime' },
			...flags
		}
	}),
	new EntitySchema({
		name: 'organization_team_employee',
		columns: {
			id: { type: 'varchar', primary: true },
			organizationTeamId: { type: 'varchar' },
			employeeId: { type: 'varchar' },
			...flags
		}
	}),
	new EntitySchema({
		name: 'user_organization',
		columns: { id: { type: 'varchar', primary: true }, userId: { type: 'varchar' }, ...flags }
	})
];

describe('AuthService — the teams a sign-in lists leave out a deleted team (#11960)', () => {
	let dbPath: string;
	let dataSource: DataSource;
	let knexClient: Knex;

	const serviceFor = (ormType: MultiORMEnum): AuthService => {
		const service = Object.create(AuthService.prototype) as AuthService;
		Object.assign(service, {
			ormType,
			typeOrmOrganizationTeamRepository: dataSource.getRepository('organization_team'),
			mikroOrmOrganizationTeamRepository: { getKnex: () => knexClient }
		});
		return service;
	};

	beforeAll(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-teams-of-deleted-organization-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			entities: schemas,
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		const insert = (table: string, values: Record<string, unknown>[]) =>
			dataSource.createQueryBuilder().insert().into(table).values(values).execute();
		const ofOrganization = { tenantId: TENANT, organizationId: ORGANIZATION };

		await insert('organization_team', [
			{ id: 'team-live', name: 'Live', createdAt: new Date('2026-11-01T00:00:00Z'), ...ofOrganization },
			{
				id: 'team-deleted',
				name: 'Deleted',
				createdAt: new Date('2026-11-02T00:00:00Z'),
				deletedAt: new Date('2026-11-14T10:00:00Z'),
				...ofOrganization
			}
		]);
		await insert('organization_team_employee', [
			{ id: 'member-live', organizationTeamId: 'team-live', employeeId: EMPLOYEE, ...ofOrganization },
			{ id: 'member-deleted', organizationTeamId: 'team-deleted', employeeId: EMPLOYEE, ...ofOrganization }
		]);
		await insert('user_organization', [{ id: 'membership', userId: USER, ...ofOrganization }]);

		knexClient = knex({ client: 'better-sqlite3', connection: { filename: dbPath }, useNullAsDefault: true });
	});

	afterAll(async () => {
		await knexClient?.destroy();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	it.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('%s: lists the live team only', async (ormType) => {
		const teams = await (serviceFor(ormType) as any).getTeamsForUser(TENANT, USER, EMPLOYEE);

		expect(teams.map((team: { team_id: string }) => team.team_id)).toEqual(['team-live']);
	});
});
