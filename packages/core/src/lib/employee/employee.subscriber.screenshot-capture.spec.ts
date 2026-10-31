/**
 * Importing `Employee` reaches `core/entities/internal` and the decorator graph. Loading that
 * graph FIRST matches the application boot order (see employee.entity.spec.ts).
 */
import '../core/entities/internal';

import { EmployeeKindEnum } from '@gauzy/contracts';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../core/utils';
import { Organization } from '../core/entities/internal';
import { Employee } from './employee.entity';
import { EmployeeSubscriber } from './employee.subscriber';

/**
 * Issue #9872 — a new employee starts with its organization's screen capture setting, through the real
 * `EmployeeSubscriber` on a real better-sqlite database. Each create path of the application ends in one of the
 * writes below:
 *
 * - `repository.save(repository.create(…))`: `EmployeeService.create` (REST `POST /employee`, `POST /employee/bulk`,
 *   GraphQL, the Add Employee form, hiring a candidate, Hubstaff/Upwork imports), invite accept and registration;
 * - `repository.insert(…)` / the insert query builder: the export-import of a tenant;
 * - `manager.save([...])`: the seeds.
 *
 * The schemas map the columns the subscriber reads and writes onto the real classes.
 */

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const ORG_OFF = 'org-capture-off';
const ORG_ON = 'org-capture-on';

const EmployeeSchema = new EntitySchema<Employee>({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		kind: { type: 'varchar', default: EmployeeKindEnum.HUMAN },
		// As the real column: on unless the write says otherwise.
		allowScreenshotCapture: { type: 'boolean', default: true },
		startedWorkOn: { type: 'datetime', nullable: true },
		endWork: { type: 'datetime', nullable: true },
		isActive: { type: 'boolean', nullable: true },
		isArchived: { type: 'boolean', nullable: true },
		isTrackingEnabled: { type: 'boolean', nullable: true },
		billRateValue: { type: 'integer', nullable: true }
	}
});

const OrganizationSchema = new EntitySchema<Organization>({
	name: 'Organization',
	target: Organization,
	tableName: 'organization',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		allowScreenshotCapture: { type: 'boolean' },
		totalEmployees: { type: 'integer', default: 0 }
	}
});

describe('EmployeeSubscriber — a new employee follows its organization’s screen capture (TypeORM round trip)', () => {
	const previousOrm = process.env.DB_ORM;

	let dataSource: DataSource;
	let employees: Repository<Employee>;
	let organizations: Repository<Organization>;

	beforeAll(async () => {
		process.env.DB_ORM = MultiORMEnum.TypeORM;
		// Starting work also updates the user's membership; that write is covered by its own spec.
		jest.spyOn(EmployeeSubscriber.prototype, 'setUserOrganizationStatus').mockResolvedValue(undefined);

		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [EmployeeSchema, OrganizationSchema],
			subscribers: [EmployeeSubscriber],
			synchronize: true,
			logging: false,
			// As the application configures it (TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR)
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		employees = dataSource.getRepository(Employee);
		organizations = dataSource.getRepository(Organization);
	});

	afterAll(async () => {
		await dataSource?.destroy();
		jest.restoreAllMocks();
		if (previousOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previousOrm;
	});

	beforeEach(async () => {
		await employees.clear();
		await organizations.clear();
		await organizations.insert([
			{ id: ORG_OFF, tenantId: TENANT, allowScreenshotCapture: false },
			{ id: ORG_ON, tenantId: TENANT, allowScreenshotCapture: true }
		] as Organization[]);
	});

	/** The stored employee, as the desktop apps get it. */
	const stored = (id: string) => employees.findOneByOrFail({ id });

	const employee = (id: string, organizationId: string, values: Partial<Employee> = {}) =>
		({ id, tenantId: TENANT, organizationId, ...values }) as Employee;

	describe('save (REST, GraphQL, bulk, invite accept, registration, integrations)', () => {
		it('stores capture off for a new employee of an organization that has it off', async () => {
			await employees.save(employees.create(employee('e-1', ORG_OFF)));

			expect((await stored('e-1')).allowScreenshotCapture).toBe(false);
		});

		it('stores capture on for a new employee of an organization that has it on (as before)', async () => {
			await employees.save(employees.create(employee('e-1', ORG_ON)));

			expect((await stored('e-1')).allowScreenshotCapture).toBe(true);
		});

		it('follows the organization when the employee starts work on creation (the Add Employee form)', async () => {
			await employees.save(employees.create(employee('e-1', ORG_OFF, { startedWorkOn: new Date('2026-10-01') })));

			expect(await stored('e-1')).toMatchObject({
				allowScreenshotCapture: false,
				isActive: true,
				isTrackingEnabled: true
			});
		});

		it('keeps a value the write states', async () => {
			await employees.save([
				employees.create(employee('e-1', ORG_OFF, { allowScreenshotCapture: true })),
				employees.create(employee('e-2', ORG_ON, { allowScreenshotCapture: false }))
			]);

			expect((await stored('e-1')).allowScreenshotCapture).toBe(true);
			expect((await stored('e-2')).allowScreenshotCapture).toBe(false);
		});

		it('reads the organization of the employee’s own tenant only', async () => {
			// No such organization in that tenant: the column default applies, as before.
			await employees.save(employees.create({ ...employee('e-1', ORG_OFF), tenantId: OTHER_TENANT }));

			expect((await stored('e-1')).allowScreenshotCapture).toBe(true);
		});
	});

	describe('insert (export-import)', () => {
		it('follows the organization when the row does not carry the flag', async () => {
			await employees.insert(employee('e-1', ORG_OFF));
			await dataSource.createQueryBuilder().insert().into(Employee).values(employee('e-2', ORG_OFF)).execute();

			expect((await stored('e-1')).allowScreenshotCapture).toBe(false);
			expect((await stored('e-2')).allowScreenshotCapture).toBe(false);
		});

		it('keeps the imported value', async () => {
			await employees.insert(employee('e-1', ORG_OFF, { allowScreenshotCapture: true }));

			expect((await stored('e-1')).allowScreenshotCapture).toBe(true);
		});
	});

	describe('manager.save of a list (seeds)', () => {
		it('gives each new employee its own organization’s setting', async () => {
			await dataSource.manager.save([
				Object.assign(new Employee(), employee('e-1', ORG_OFF)),
				Object.assign(new Employee(), employee('e-2', ORG_ON))
			]);

			expect((await stored('e-1')).allowScreenshotCapture).toBe(false);
			expect((await stored('e-2')).allowScreenshotCapture).toBe(true);
		});
	});

	describe('existing employees', () => {
		it('keep their value when the organization turns capture off and when they are edited', async () => {
			await employees.save(employees.create(employee('e-1', ORG_ON)));
			await organizations.update({ id: ORG_ON }, { allowScreenshotCapture: false });

			const existing = await stored('e-1');
			existing.billRateValue = 50;
			await employees.save(existing);

			expect(await stored('e-1')).toMatchObject({ allowScreenshotCapture: true, billRateValue: 50 });
		});
	});
});
