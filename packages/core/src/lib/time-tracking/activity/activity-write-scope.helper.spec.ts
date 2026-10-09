import { DataSource, EntitySchema, Repository } from 'typeorm';
import { scopeActivitiesForWrite } from './activity-write-scope.helper';

/**
 * GHSA-6qvm-3wg4-26w4 — body-supplied activity ids reached `repository.save()`, which upserts by
 * primary key alone. Real better-sqlite3 database; the CONTROL arm saves the same body the pre-fix
 * way and shows another tenant's activity being overwritten and moved.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const TimeSlotSchema = new EntitySchema<any>({
	name: 'TimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true }
	}
});

const ProjectSchema = new EntitySchema<any>({
	name: 'OrganizationProject',
	tableName: 'organization_project',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		name: { type: 'varchar', nullable: true }
	}
});

const TaskSchema = new EntitySchema<any>({
	name: 'Task',
	tableName: 'task',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		title: { type: 'varchar', nullable: true }
	}
});

const ActivitySchema = new EntitySchema<any>({
	name: 'Activity',
	tableName: 'activity',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		title: { type: 'varchar', nullable: true },
		timeSlotId: { type: 'varchar', nullable: true },
		projectId: { type: 'varchar', nullable: true },
		taskId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		timeSlot: { type: 'many-to-one', target: 'TimeSlot', joinColumn: { name: 'timeSlotId' } },
		project: { type: 'many-to-one', target: 'OrganizationProject', joinColumn: { name: 'projectId' } },
		task: { type: 'many-to-one', target: 'Task', joinColumn: { name: 'taskId' } }
	}
});

describe('scopeActivitiesForWrite (GHSA-6qvm-3wg4-26w4)', () => {
	let dataSource: DataSource;
	let activities: Repository<any>;
	let slots: Repository<any>;
	let foreignActivity: any;
	let ownActivity: any;
	let ownSlot: any;
	let foreignSlot: any;
	let ownProject: any;
	let foreignProject: any;
	let foreignTask: any;

	const SCOPE = { tenantId: TENANT_A, employeeId: 'employee-a' };

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeSlotSchema, ProjectSchema, TaskSchema, ActivitySchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		activities = dataSource.getRepository('Activity');
		slots = dataSource.getRepository('TimeSlot');
		ownSlot = await slots.save({ tenantId: TENANT_A, employeeId: 'employee-a' });
		foreignSlot = await slots.save({ tenantId: TENANT_B, employeeId: 'employee-b' });
		ownActivity = await activities.save({ tenantId: TENANT_A, employeeId: 'employee-a', title: 'own' });
		foreignActivity = await activities.save({ tenantId: TENANT_B, employeeId: 'employee-b', title: 'theirs' });
		ownProject = await dataSource.getRepository('OrganizationProject').save({ tenantId: TENANT_A, name: 'ours' });
		foreignProject = await dataSource.getRepository('OrganizationProject').save({ tenantId: TENANT_B, name: 'theirs' });
		foreignTask = await dataSource.getRepository('Task').save({ tenantId: TENANT_B, title: 'theirs' });
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('CONTROL: saving the body as-is overwrites and re-tenants the foreign activity', async () => {
		await activities.save([{ id: foreignActivity.id, title: 'stolen', ...SCOPE }]);

		expect(await activities.findOneBy({ id: foreignActivity.id })).toMatchObject({
			title: 'stolen',
			tenantId: TENANT_A
		});
	});

	it('drops the foreign id, so the foreign activity is left alone and a new row is inserted', async () => {
		const body = [{ id: foreignActivity.id, title: 'stolen' }];

		const scoped = await scopeActivitiesForWrite(body as any[], activities, SCOPE);
		await activities.save(scoped.map((activity) => ({ ...activity, ...SCOPE })));

		expect(await activities.findOneBy({ id: foreignActivity.id })).toMatchObject({
			title: 'theirs',
			tenantId: TENANT_B
		});
		expect(await activities.countBy({ title: 'stolen', tenantId: TENANT_A })).toBe(1);
	});

	it("keeps the employee's own id (a re-sent activity still updates in place), soft-deleted ones included", async () => {
		await activities.softDelete({ id: ownActivity.id });

		const [scoped] = await scopeActivitiesForWrite([{ id: ownActivity.id, title: 'again' }] as any[], activities, SCOPE);

		expect(scoped.id).toBe(ownActivity.id);
	});

	it("keeps an own time slot link and drops a foreign one", async () => {
		const scoped = await scopeActivitiesForWrite(
			[{ timeSlotId: ownSlot.id }, { timeSlotId: foreignSlot.id }] as any[],
			activities,
			SCOPE
		);

		expect(scoped.map((activity) => activity.timeSlotId)).toEqual([ownSlot.id, undefined]);
	});

	it('strips relation objects that would override the forced scope', async () => {
		const [scoped] = await scopeActivitiesForWrite(
			[{ title: 'x', tenant: { id: TENANT_B }, organization: { id: 'o' }, employee: { id: 'e' }, timeSlot: { id: 's' } }] as any[],
			activities,
			SCOPE
		);

		expect(scoped).toEqual({ title: 'x' });
	});

	it("keeps the tenant's own project and drops another tenant's project and task", async () => {
		// A foreign projectId is stored verbatim by the raw save() and joined back on read, which hands
		// the caller a project of the victim tenant; the nested-graph check never sees a plain FK.
		const scoped = await scopeActivitiesForWrite(
			[
				{ title: 'mine', projectId: ownProject.id },
				{ title: 'theirs', projectId: foreignProject.id, taskId: foreignTask.id }
			] as any[],
			activities,
			SCOPE
		);

		expect(scoped).toEqual([{ title: 'mine', projectId: ownProject.id }, { title: 'theirs' }]);
	});

	it('folds a project relation object into the id and scopes it the same way', async () => {
		const scoped = await scopeActivitiesForWrite(
			[
				{ title: 'mine', project: { id: ownProject.id } },
				{ title: 'theirs', project: { id: foreignProject.id } }
			] as any[],
			activities,
			SCOPE
		);

		expect(scoped).toEqual([{ title: 'mine', projectId: ownProject.id }, { title: 'theirs' }]);
	});

	it('keeps no id at all without an employee to scope by', async () => {
		const [scoped] = await scopeActivitiesForWrite([{ id: ownActivity.id }] as any[], activities, {
			tenantId: TENANT_A,
			employeeId: null
		});

		expect(scoped.id).toBeUndefined();
	});
});
