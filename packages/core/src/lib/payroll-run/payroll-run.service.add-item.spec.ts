/**
 * Load the entity graph FIRST, as the application does (see payroll-run.resolver.spec.ts).
 */
import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { PayrollItemCategoryEnum, PayrollItemTypeEnum, PayrollRunStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { Employee } from '../core/entities/internal';
import { PayrollItem } from '../payroll-item/payroll-item.entity';
import { PayrollRun } from './payroll-run.entity';
import { PayrollRunService } from './payroll-run.service';

/**
 * #10688: adding a line to a draft run answered 201, but `recalculateTotals` then saved the run object
 * `addItem` had read with its `items`. That list does not hold the new line and `payrollRunId` is not
 * nullable, so TypeORM deleted the line as an orphan. Only the totals are written now.
 *
 * A real better-sqlite database, so the orphan handling is TypeORM's own. The schemas map the columns
 * the service reads and writes onto the real classes it passes to the entity manager.
 */

const TENANT = 'tenant-1';
const ORG = 'org-1';
const EMPLOYEE = 'employee-1';
const RUN = 'run-1';

const RunSchema = new EntitySchema<PayrollRun>({
	name: 'PayrollRun',
	target: PayrollRun,
	tableName: 'payroll_run',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		status: { type: 'varchar' },
		totalGross: { type: 'numeric', default: 0 },
		totalDeductions: { type: 'numeric', default: 0 },
		totalNet: { type: 'numeric', default: 0 }
	} as any,
	relations: {
		items: { type: 'one-to-many', target: 'PayrollItem', inverseSide: 'payrollRun' }
	} as any
});

const ItemSchema = new EntitySchema<PayrollItem>({
	name: 'PayrollItem',
	target: PayrollItem,
	tableName: 'payroll_item',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		payrollRunId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		type: { type: 'varchar' },
		category: { type: 'varchar' },
		amount: { type: 'numeric' },
		taxable: { type: 'boolean', default: true }
	} as any,
	relations: {
		payrollRun: {
			type: 'many-to-one',
			target: 'PayrollRun',
			inverseSide: 'items',
			joinColumn: { name: 'payrollRunId' },
			onDelete: 'CASCADE'
		}
	} as any
});

const EmployeeSchema = new EntitySchema<Employee>({
	name: 'Employee',
	target: Employee,
	tableName: 'employee',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' }
	} as any
});

describe('PayrollRunService.addItem — the added line stays on the run', () => {
	let dataSource: DataSource;
	let runs: Repository<PayrollRun>;
	let items: Repository<PayrollItem>;
	let service: PayrollRunService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [RunSchema, ItemSchema, EmployeeSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		runs = dataSource.getRepository(PayrollRun);
		items = dataSource.getRepository(PayrollItem);
		await dataSource.getRepository(Employee).insert({ id: EMPLOYEE, tenantId: TENANT, organizationId: ORG });
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await items.clear();
		await runs.clear();
		await runs.insert({
			id: RUN,
			tenantId: TENANT,
			organizationId: ORG,
			status: PayrollRunStatusEnum.DRAFT
		} as PayrollRun);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		service = new PayrollRunService(runs as any, {} as any, items as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const line = (category: PayrollItemCategoryEnum, amount: number) => ({
		organizationId: ORG,
		employeeId: EMPLOYEE,
		type: PayrollItemTypeEnum.BASIC_SALARY,
		category,
		amount
	});

	/** The run's lines and totals as stored. */
	async function stored() {
		const run = await runs.findOneOrFail({ where: { id: RUN } });
		const lines = await items.find({ where: { payrollRunId: RUN } as any });
		return {
			lines: lines.length,
			totalGross: Number(run.totalGross),
			totalDeductions: Number(run.totalDeductions),
			totalNet: Number(run.totalNet)
		};
	}

	it('keeps the line it adds and stores totals that count it', async () => {
		const added = await service.addItem(RUN, line(PayrollItemCategoryEnum.EARNING, 1000) as any);

		expect(await items.findOne({ where: { id: added.id } })).not.toBeNull();
		expect(await stored()).toEqual({ lines: 1, totalGross: 1000, totalDeductions: 0, totalNet: 1000 });
	});

	it('keeps every line across several additions', async () => {
		await service.addItem(RUN, line(PayrollItemCategoryEnum.EARNING, 1000) as any);
		await service.addItem(RUN, line(PayrollItemCategoryEnum.DEDUCTION, 200.1) as any);

		expect(await stored()).toEqual({ lines: 2, totalGross: 1000, totalDeductions: 200.1, totalNet: 799.9 });
	});
});
