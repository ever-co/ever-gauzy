import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { countOrganizationContents } from './organization-counts';
import {
	hideOrganization,
	IOrganizationOfTenant,
	ORGANIZATION_LAST_OF_WORKSPACE,
	restoreOrganization
} from './organization-deletion';

/**
 * Soft deleting and restoring an organization (ever-co/ever-gauzy#11960), on SQLite, with the tables named as the
 * API names them and the columns the statements read and write. The data source resolves a table name to its entity,
 * so these tables get the statements the entities get.
 */

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const TRIAL = 'org-trial';
const MAIN = 'org-main';
const SIDE = 'org-side';
const FOREIGN = 'org-foreign';
const TRIAL_TEAM = 'team-trial';
const TRIAL_OLD_TEAM = 'team-trial-old';
const MAIN_TEAM = 'team-main';
const EARLIER = new Date('2026-05-01T08:00:00.000Z');

const ofTenant = (id: string, tenantId = TENANT): IOrganizationOfTenant => ({ id, tenantId });

const softDeletable = { deletedAt: { type: 'datetime', nullable: true, deleteDate: true } } as const;
const ofOrganization = { tenantId: { type: 'varchar' }, organizationId: { type: 'varchar' } } as const;
const activity = {
	isActive: { type: 'boolean', default: true },
	isArchived: { type: 'boolean', default: false, nullable: true }
} as const;

const schemas = [
	new EntitySchema({
		name: 'organization',
		columns: { id: { type: 'varchar', primary: true }, tenantId: { type: 'varchar' }, ...softDeletable }
	}),
	new EntitySchema({
		name: 'organization_team',
		columns: { id: { type: 'varchar', primary: true }, ...ofOrganization, ...activity, ...softDeletable }
	}),
	new EntitySchema({
		name: 'organization_team_employee',
		columns: {
			id: { type: 'varchar', primary: true },
			...ofOrganization,
			organizationTeamId: { type: 'varchar' },
			employeeId: { type: 'varchar' },
			...softDeletable
		}
	}),
	new EntitySchema({
		name: 'user_organization',
		columns: {
			id: { type: 'varchar', primary: true },
			...ofOrganization,
			userId: { type: 'varchar' },
			createdAt: { type: 'datetime' },
			...activity,
			...softDeletable
		}
	}),
	new EntitySchema({
		name: 'employee',
		columns: {
			id: { type: 'varchar', primary: true },
			...ofOrganization,
			userId: { type: 'varchar' },
			...activity,
			...softDeletable
		}
	}),
	new EntitySchema({
		name: 'user',
		columns: {
			id: { type: 'varchar', primary: true },
			tenantId: { type: 'varchar' },
			lastOrganizationId: { type: 'varchar', nullable: true },
			defaultOrganizationId: { type: 'varchar', nullable: true },
			lastTeamId: { type: 'varchar', nullable: true },
			...softDeletable
		}
	}),
	new EntitySchema({
		name: 'invite',
		columns: { id: { type: 'varchar', primary: true }, ...ofOrganization, ...softDeletable }
	}),
	new EntitySchema({
		name: 'organization_project',
		columns: { id: { type: 'varchar', primary: true }, ...ofOrganization, ...softDeletable }
	}),
	new EntitySchema({
		name: 'invoice',
		columns: {
			id: { type: 'varchar', primary: true },
			...ofOrganization,
			isEstimate: { type: 'boolean', nullable: true },
			...softDeletable
		}
	}),
	new EntitySchema({
		name: 'time_log',
		columns: {
			id: { type: 'varchar', primary: true },
			...ofOrganization,
			startedAt: { type: 'datetime' },
			stoppedAt: { type: 'datetime', nullable: true },
			...softDeletable
		}
	})
];

/** A member of an organization: the membership and the member record. */
const member = (userId: string, organizationId: string, createdAt: string, rest: Record<string, unknown> = {}) => ({
	membership: {
		id: `uo-${userId}-${organizationId}`,
		tenantId: TENANT,
		organizationId,
		userId,
		createdAt: new Date(createdAt),
		...rest
	},
	employee: { id: `emp-${userId}-${organizationId}`, tenantId: TENANT, organizationId, userId }
});

describe('Soft deleting an organization (#11960)', () => {
	let dataSource: DataSource;

	const rows = (table: string): Promise<Record<string, any>[]> =>
		dataSource.query(`SELECT * FROM "${table}" ORDER BY "id"`);
	const row = async (table: string, id: string): Promise<Record<string, any>> =>
		(await rows(table)).find((candidate) => candidate.id === id);
	const hide = (organization: IOrganizationOfTenant, at = new Date('2026-11-14T10:00:00.123Z')) =>
		dataSource.transaction((manager) => hideOrganization(manager, organization, at));
	const restore = (organization: IOrganizationOfTenant) =>
		dataSource.transaction((manager) => restoreOrganization(manager, organization));
	const failureOf = (promise: Promise<unknown>): Promise<any> =>
		promise.then(
			() => null,
			(error) => error
		);

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: schemas,
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		const insert = (table: string, values: Record<string, unknown>[]) =>
			dataSource.createQueryBuilder().insert().into(table).values(values).execute();

		await insert('organization', [
			{ id: TRIAL, tenantId: TENANT },
			{ id: MAIN, tenantId: TENANT },
			{ id: SIDE, tenantId: TENANT },
			{ id: FOREIGN, tenantId: OTHER_TENANT }
		]);
		await insert('organization_team', [
			{ id: TRIAL_TEAM, tenantId: TENANT, organizationId: TRIAL },
			{ id: TRIAL_OLD_TEAM, tenantId: TENANT, organizationId: TRIAL, deletedAt: EARLIER },
			{ id: MAIN_TEAM, tenantId: TENANT, organizationId: MAIN }
		]);

		const members = [
			// alice: her oldest other membership is SIDE
			member('alice', SIDE, '2026-01-01T00:00:00Z'),
			member('alice', MAIN, '2026-02-01T00:00:00Z'),
			member('alice', TRIAL, '2026-03-01T00:00:00Z'),
			// bob: only in TRIAL
			member('bob', TRIAL, '2026-03-01T00:00:00Z'),
			// carol: her oldest membership, SIDE, is inactive
			member('carol', SIDE, '2026-01-01T00:00:00Z', { isActive: false }),
			member('carol', MAIN, '2026-02-01T00:00:00Z'),
			member('carol', TRIAL, '2026-03-01T00:00:00Z'),
			// dave: his other membership is archived
			member('dave', SIDE, '2026-01-01T00:00:00Z', { isArchived: true }),
			member('dave', TRIAL, '2026-03-01T00:00:00Z')
		];
		await insert(
			'user_organization',
			members.map((entry) => entry.membership)
		);
		await insert(
			'employee',
			members.map((entry) => entry.employee)
		);
		await insert('organization_team_employee', [
			{
				id: 'otm-alice',
				tenantId: TENANT,
				organizationId: TRIAL,
				organizationTeamId: TRIAL_TEAM,
				employeeId: 'emp-alice-org-trial'
			},
			{
				id: 'otm-bob',
				tenantId: TENANT,
				organizationId: TRIAL,
				organizationTeamId: TRIAL_TEAM,
				employeeId: 'emp-bob-org-trial'
			},
			{
				id: 'otm-alice-main',
				tenantId: TENANT,
				organizationId: MAIN,
				organizationTeamId: MAIN_TEAM,
				employeeId: 'emp-alice-org-main'
			}
		]);
		await insert('user', [
			{
				id: 'alice',
				tenantId: TENANT,
				lastOrganizationId: TRIAL,
				defaultOrganizationId: TRIAL,
				lastTeamId: TRIAL_TEAM
			},
			{
				id: 'bob',
				tenantId: TENANT,
				lastOrganizationId: TRIAL,
				defaultOrganizationId: null,
				lastTeamId: TRIAL_TEAM
			},
			{
				id: 'carol',
				tenantId: TENANT,
				lastOrganizationId: MAIN,
				defaultOrganizationId: TRIAL,
				lastTeamId: MAIN_TEAM
			},
			{ id: 'dave', tenantId: TENANT, lastOrganizationId: TRIAL, defaultOrganizationId: null, lastTeamId: null },
			// gina's last team is a team of TRIAL deleted earlier
			{
				id: 'gina',
				tenantId: TENANT,
				lastOrganizationId: MAIN,
				defaultOrganizationId: null,
				lastTeamId: TRIAL_OLD_TEAM
			}
		]);
		await insert('invite', [
			{ id: 'invite-trial', tenantId: TENANT, organizationId: TRIAL },
			{ id: 'invite-main', tenantId: TENANT, organizationId: MAIN }
		]);
		await insert('organization_project', [
			{ id: 'project-trial', tenantId: TENANT, organizationId: TRIAL },
			{ id: 'project-main', tenantId: TENANT, organizationId: MAIN }
		]);
		await insert('invoice', [
			{ id: 'invoice-1', tenantId: TENANT, organizationId: TRIAL, isEstimate: false },
			{ id: 'invoice-2', tenantId: TENANT, organizationId: TRIAL, isEstimate: null },
			{ id: 'estimate-1', tenantId: TENANT, organizationId: TRIAL, isEstimate: true },
			{ id: 'invoice-main', tenantId: TENANT, organizationId: MAIN, isEstimate: false }
		]);
		await insert('time_log', [
			{
				id: 'log-1',
				tenantId: TENANT,
				organizationId: TRIAL,
				startedAt: new Date('2026-11-10T09:00:00Z'),
				stoppedAt: new Date('2026-11-10T10:00:00Z')
			},
			{
				id: 'log-2',
				tenantId: TENANT,
				organizationId: TRIAL,
				startedAt: new Date('2026-11-11T09:00:00Z'),
				stoppedAt: new Date('2026-11-11T09:30:00Z')
			},
			{
				id: 'log-deleted',
				tenantId: TENANT,
				organizationId: TRIAL,
				startedAt: new Date('2026-11-12T09:00:00Z'),
				stoppedAt: new Date('2026-11-12T11:00:00Z'),
				deletedAt: EARLIER
			}
		]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	it('marks the organization, its invitations, teams, team members, memberships and members with one instant', async () => {
		const hidden = await hide(ofTenant(TRIAL));

		expect(hidden.rows).toEqual({
			invite: 1,
			organization_team_employee: 2,
			organization_team: 1,
			user_organization: 4,
			employee: 4
		});
		const deletedAt = (await row('organization', TRIAL)).deletedAt;
		expect(deletedAt).toBeTruthy();
		for (const table of ['invite', 'organization_team_employee', 'user_organization', 'employee']) {
			const ofTrial = (await rows(table)).filter((candidate) => candidate.organizationId === TRIAL);
			expect(ofTrial.map((candidate) => candidate.deletedAt)).toEqual(ofTrial.map(() => deletedAt));
		}
		expect((await row('organization_team', TRIAL_TEAM)).deletedAt).toBe(deletedAt);
	});

	it('leaves a team deleted earlier, the other organizations, and the projects, time and invoices as they were', async () => {
		const earlierTeam = (await row('organization_team', TRIAL_OLD_TEAM)).deletedAt;

		await hide(ofTenant(TRIAL));

		expect((await row('organization_team', TRIAL_OLD_TEAM)).deletedAt).toBe(earlierTeam);
		expect((await row('organization', MAIN)).deletedAt).toBeNull();
		expect((await row('organization_team', MAIN_TEAM)).deletedAt).toBeNull();
		expect((await row('organization_team_employee', 'otm-alice-main')).deletedAt).toBeNull();
		expect((await row('invite', 'invite-main')).deletedAt).toBeNull();
		const otherMemberships = (await rows('user_organization')).filter(
			(candidate) => candidate.organizationId !== TRIAL
		);
		expect(otherMemberships.every((candidate) => candidate.deletedAt === null)).toBe(true);
		for (const table of ['organization_project', 'invoice']) {
			expect((await rows(table)).every((candidate) => candidate.deletedAt === null)).toBe(true);
		}
		expect((await row('time_log', 'log-1')).deletedAt).toBeNull();
	});

	it("moves members' last and default organization to their oldest other active membership, or to none", async () => {
		const hidden = await hide(ofTenant(TRIAL));

		expect(await row('user', 'alice')).toMatchObject({ lastOrganizationId: SIDE, defaultOrganizationId: SIDE });
		expect(await row('user', 'bob')).toMatchObject({ lastOrganizationId: null, defaultOrganizationId: null });
		// carol's SIDE membership is inactive: her default lands in MAIN, her last organization was MAIN already
		expect(await row('user', 'carol')).toMatchObject({ lastOrganizationId: MAIN, defaultOrganizationId: MAIN });
		// dave's SIDE membership is archived
		expect(await row('user', 'dave')).toMatchObject({ lastOrganizationId: null });
		expect(hidden).toMatchObject({ lastOrganizationMoved: 3, defaultOrganizationMoved: 2 });
	});

	it('clears a last team that is one of its teams, a team deleted earlier included, and only those', async () => {
		const hidden = await hide(ofTenant(TRIAL));

		expect((await row('user', 'alice')).lastTeamId).toBeNull();
		expect((await row('user', 'bob')).lastTeamId).toBeNull();
		expect((await row('user', 'gina')).lastTeamId).toBeNull();
		expect((await row('user', 'carol')).lastTeamId).toBe(MAIN_TEAM);
		expect(hidden.lastTeamCleared).toBe(3);
		expect((await row('organization_team', TRIAL_OLD_TEAM)).deletedAt).toBeTruthy();
	});

	it('refuses the last organization of a workspace, says why, and marks nothing', async () => {
		await hide(ofTenant(MAIN));
		await hide(ofTenant(SIDE));

		const error = await failureOf(hide(ofTenant(TRIAL)));

		expect(error).toBeInstanceOf(ConflictException);
		expect(error.getResponse()).toMatchObject({ code: ORGANIZATION_LAST_OF_WORKSPACE });
		expect((await row('organization', TRIAL)).deletedAt).toBeNull();
		expect((await row('organization_team', TRIAL_TEAM)).deletedAt).toBeNull();
		expect((await row('user', 'bob')).lastOrganizationId).toBe(TRIAL);
	});

	it('answers 404 for an organization of another workspace, or one already deleted', async () => {
		expect(await failureOf(hide(ofTenant(FOREIGN)))).toBeInstanceOf(NotFoundException);

		await hide(ofTenant(TRIAL));
		expect(await failureOf(hide(ofTenant(TRIAL)))).toBeInstanceOf(NotFoundException);
	});

	describe('restore', () => {
		it('brings back what the delete hid, and only that', async () => {
			const before = await Promise.all(
				[
					'organization',
					'invite',
					'organization_team',
					'organization_team_employee',
					'user_organization',
					'employee'
				].map(rows)
			);

			await hide(ofTenant(TRIAL));
			const restored = await restore(ofTenant(TRIAL));

			expect(restored.rows).toEqual({
				invite: 1,
				organization_team_employee: 2,
				organization_team: 1,
				user_organization: 4,
				employee: 4
			});
			const after = await Promise.all(
				[
					'organization',
					'invite',
					'organization_team',
					'organization_team_employee',
					'user_organization',
					'employee'
				].map(rows)
			);
			expect(after).toEqual(before);
		});

		it("leaves the members' last and default organization where the delete moved them", async () => {
			await hide(ofTenant(TRIAL));
			const moved = await rows('user');

			await restore(ofTenant(TRIAL));

			// A pointer the delete cleared (bob's, dave's) reads like one never set: the restore touches neither.
			expect(await rows('user')).toEqual(moved);
		});

		it('changes nothing for an organization that is not deleted', async () => {
			const before = await rows('organization_team');

			const restored = await restore(ofTenant(MAIN));

			expect(restored.rows).toEqual({
				invite: 0,
				organization_team_employee: 0,
				organization_team: 0,
				user_organization: 0,
				employee: 0
			});
			expect(await rows('organization_team')).toEqual(before);
		});

		it('answers 404 for an organization of another workspace', async () => {
			expect(await failureOf(restore(ofTenant(FOREIGN)))).toBeInstanceOf(NotFoundException);
		});
	});

	describe('counts', () => {
		it('counts the teams, projects, members, tracked seconds, invoices and estimates it holds', async () => {
			// One more member whose archive flag is unset (the column is nullable), and one archived member
			await dataSource
				.createQueryBuilder()
				.insert()
				.into('employee')
				.values([
					{ id: 'emp-erin', tenantId: TENANT, organizationId: TRIAL, userId: 'erin', isArchived: null },
					{ id: 'emp-frank', tenantId: TENANT, organizationId: TRIAL, userId: 'frank', isArchived: true }
				])
				.execute();

			const counts = await countOrganizationContents(dataSource.manager, ofTenant(TRIAL));

			expect(counts).toEqual({
				teams: 1,
				projects: 1,
				members: 5,
				trackedSeconds: 5400,
				invoices: 2,
				estimates: 1
			});
		});

		it('leaves out what the soft delete hid, and comes back with the restore', async () => {
			await hide(ofTenant(TRIAL));
			expect(await countOrganizationContents(dataSource.manager, ofTenant(TRIAL))).toMatchObject({
				teams: 0,
				members: 0,
				projects: 1
			});

			await restore(ofTenant(TRIAL));
			expect(await countOrganizationContents(dataSource.manager, ofTenant(TRIAL))).toMatchObject({
				teams: 1,
				members: 4
			});
		});
	});
});
