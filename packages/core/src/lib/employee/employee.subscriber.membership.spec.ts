/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../core/utils';
import { UserOrganization } from '../core/entities/internal';
import { Employee } from './employee.entity';
import { EmployeeSubscriber } from './employee.subscriber';

/**
 * Starting or ending work also sets the user's membership of the employee's organization. Under TypeORM
 * the hook's entity holds only the payload, and a write may omit the organization (Back to Work sends
 * only `endWork: null`): the membership was then left as it was. The stored employee's organization is
 * used now, and an organization the employee does not belong to still changes nothing.
 *
 * A real better-sqlite database; the schemas map the columns the update reads and writes onto the real classes.
 */

const TENANT = 'tenant-1';
const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const USER = 'user-1';
const EMPLOYEE = 'employee-1';

const EmployeeSchema = new EntitySchema<Employee>({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		userId: { type: 'varchar' }
	} as any
});

const UserOrganizationSchema = new EntitySchema<UserOrganization>({
	name: 'UserOrganization',
	target: UserOrganization,
	tableName: 'user_organization',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		userId: { type: 'varchar' },
		isActive: { type: 'boolean' },
		isArchived: { type: 'boolean' }
	} as any
});

describe('EmployeeSubscriber.setUserOrganizationStatus — TypeORM round trip', () => {
	const previousOrm = process.env.DB_ORM;

	let dataSource: DataSource;
	let memberships: Repository<UserOrganization>;
	let subscriber: EmployeeSubscriber;

	beforeAll(async () => {
		process.env.DB_ORM = MultiORMEnum.TypeORM;
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [EmployeeSchema, UserOrganizationSchema],
			synchronize: true,
			logging: false,
			// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		memberships = dataSource.getRepository(UserOrganization);
		await dataSource
			.getRepository(Employee)
			.insert({ id: EMPLOYEE, tenantId: TENANT, organizationId: ORG, userId: USER } as Employee);
	});

	afterAll(async () => {
		await dataSource?.destroy();
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	beforeEach(async () => {
		subscriber = new EmployeeSubscriber();
		await memberships.clear();
		// The user's membership of the employee's organization, and of another one: both archived (End Work).
		await memberships.insert([
			{
				id: 'membership-1',
				tenantId: TENANT,
				organizationId: ORG,
				userId: USER,
				isActive: false,
				isArchived: true
			},
			{
				id: 'membership-2',
				tenantId: TENANT,
				organizationId: OTHER_ORG,
				userId: USER,
				isActive: false,
				isArchived: true
			}
		] as UserOrganization[]);
	});

	/** Each membership's flags, by organization. */
	async function stored() {
		const rows = await memberships.find({ order: { organizationId: 'ASC' } as any });
		return Object.fromEntries(rows.map((row) => [row.organizationId, [!!row.isActive, !!row.isArchived]]));
	}

	/** The hook's entity as TypeORM hands it over: the payload, with the tenant the service stamps. */
	const payload = (values: Partial<Employee>) =>
		Object.assign(new Employee(), { id: EMPLOYEE, tenantId: TENANT, ...values });

	it('Back to Work without an organization reactivates the membership of the employee organization only', async () => {
		await subscriber.setUserOrganizationStatus(dataSource.manager, payload({ endWork: null }), true, false);

		expect(await stored()).toEqual({ [ORG]: [true, false], [OTHER_ORG]: [false, true] });
	});

	it('Back to Work that sends the organization reactivates the same membership', async () => {
		await subscriber.setUserOrganizationStatus(
			dataSource.manager,
			payload({ endWork: null, organizationId: ORG }),
			true,
			false
		);

		expect(await stored()).toEqual({ [ORG]: [true, false], [OTHER_ORG]: [false, true] });
	});

	it('an organization the employee does not belong to changes no membership', async () => {
		await subscriber.setUserOrganizationStatus(
			dataSource.manager,
			payload({ endWork: null, organizationId: OTHER_ORG }),
			true,
			false
		);

		expect(await stored()).toEqual({ [ORG]: [false, true], [OTHER_ORG]: [false, true] });
	});

	it('End Work without an organization archives the membership of the employee organization only', async () => {
		await memberships.update({ organizationId: ORG }, { isActive: true, isArchived: false });

		await subscriber.setUserOrganizationStatus(dataSource.manager, payload({ endWork: new Date() }), false, true);

		expect(await stored()).toEqual({ [ORG]: [false, true], [OTHER_ORG]: [false, true] });
	});
});
