import { DataSource, EntitySchema, Repository } from 'typeorm';
import { EmployeeKindEnum } from '@gauzy/contracts';
import { Employee } from '../../core/entities/internal';
import { PayrollItem } from '../../payroll-item/payroll-item.entity';
import { PayrollRun } from '../payroll-run.entity';
import { PayrollRunService } from '../payroll-run.service';

/**
 * A real, in-memory better-sqlite3 store for `PayrollRunService` specs.
 *
 * The schemas map the columns the service reads and writes onto the REAL classes it hands the entity manager, so
 * what a spec sees is TypeORM's own behaviour (orphan removal, the affected count of a conditional UPDATE) rather
 * than a mock's. Only those columns are mapped: the full entity graph carries column types SQLite cannot hold.
 *
 * Import `../core/entities/internal` before this file, as the application loads the entity graph first.
 */

const PayrollRunSchema = new EntitySchema<PayrollRun>({
	name: 'PayrollRun',
	target: PayrollRun,
	tableName: 'payroll_run',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		status: { type: 'varchar' },
		currency: { type: 'varchar', length: 3, default: 'USD' },
		totalGross: { type: 'numeric', default: 0 },
		totalDeductions: { type: 'numeric', default: 0 },
		totalNet: { type: 'numeric', default: 0 },
		paidAt: { type: 'datetime', nullable: true }
	} as any,
	relations: {
		items: { type: 'one-to-many', target: 'PayrollItem', inverseSide: 'payrollRun' }
	} as any
});

const PayrollItemSchema = new EntitySchema<PayrollItem>({
	name: 'PayrollItem',
	target: PayrollItem,
	tableName: 'payroll_item',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		payrollRunId: { type: 'varchar' },
		employeeId: { type: 'varchar', nullable: true },
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
		organizationId: { type: 'varchar' },
		// addItem pays people only: it reads the kind of the employee and refuses an agent
		kind: { type: 'varchar', length: 16, default: EmployeeKindEnum.HUMAN }
	} as any
});

export interface IPayrollStore {
	dataSource: DataSource;
	runs: Repository<PayrollRun>;
	items: Repository<PayrollItem>;
	employees: Repository<Employee>;
}

/**
 * Opens a fresh in-memory store with the payroll and employee tables. Destroy `dataSource` in `afterAll`.
 */
export async function createPayrollStore(): Promise<IPayrollStore> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [PayrollRunSchema, PayrollItemSchema, EmployeeSchema],
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();

	return {
		dataSource,
		runs: dataSource.getRepository(PayrollRun),
		items: dataSource.getRepository(PayrollItem),
		employees: dataSource.getRepository(Employee)
	};
}

/**
 * The service over the store, wired as `PayrollRunModule` wires it. Its payroll paths all go through the TypeORM
 * repositories, so no MikroORM repository is given.
 */
export function payrollRunServiceOver(store: IPayrollStore): PayrollRunService {
	return new PayrollRunService(store.runs as any, {} as any, store.items as any);
}
