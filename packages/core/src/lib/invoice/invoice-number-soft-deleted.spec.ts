import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { knex, Knex } from 'knex';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { InvoiceService } from './invoice.service';

/**
 * A soft-deleted invoice keeps its number under UNIQUE(tenantId, invoiceNumber). The TypeORM query builder
 * leaves deleted rows out of the highest number by default, so the next number handed out (max + 1, as the
 * order invoicing does) was already taken and the insert failed; the MikroORM (knex) branch counted them.
 */
const TENANT = '6b6c8a5e-0b0a-4e2b-9d1a-0f1f2a3b4c5d';

interface InvoiceRow {
	id: string;
	tenantId: string;
	invoiceNumber: number;
	deletedAt: Date | null;
}

const InvoiceSchema = new EntitySchema<InvoiceRow>({
	name: 'invoice',
	tableName: 'invoice',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		invoiceNumber: { type: 'numeric' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

describe('InvoiceService.getHighestInvoiceNumber counts soft-deleted invoices', () => {
	let dbPath: string;
	let dataSource: DataSource;
	let repository: Repository<InvoiceRow>;
	let knexClient: Knex;

	const serviceFor = (ormType: MultiORMEnum): InvoiceService => {
		const service = Object.create(InvoiceService.prototype) as InvoiceService;
		Object.defineProperty(service, 'typeOrmRepository', { value: repository });
		Object.defineProperty(service, 'mikroOrmRepository', {
			value: { getEntityManager: () => ({ getKnex: () => knexClient }) }
		});
		Object.defineProperty(service, 'ormType', { value: ormType });
		return service;
	};

	beforeAll(async () => {
		dbPath = path.join(os.tmpdir(), `gauzy-invoice-number-deleted-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			entities: [InvoiceSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		repository = dataSource.getRepository(InvoiceSchema);
		await repository.insert([
			{ id: 'invoice-9', tenantId: TENANT, invoiceNumber: 9, deletedAt: null },
			{ id: 'invoice-10', tenantId: TENANT, invoiceNumber: 10, deletedAt: new Date('2026-10-01') }
		]);
		knexClient = knex({ client: 'better-sqlite3', connection: { filename: dbPath }, useNullAsDefault: true });
	});

	afterAll(async () => {
		await knexClient?.destroy();
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
		'%s: returns the number of the soft-deleted last invoice, which is still taken',
		async (ormType) => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			const result: any = await serviceFor(ormType).getHighestInvoiceNumber();
			expect(Number(result.max)).toBe(10);
		}
	);
});
