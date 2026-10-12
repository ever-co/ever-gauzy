import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { knex, Knex } from 'knex';
import { DataSource, EntitySchema, Repository, getMetadataArgsStorage } from 'typeorm';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { InvoiceDTO } from './dto/invoice.dto';
import { Invoice } from './invoice.entity';
import { InvoiceService } from './invoice.service';

/**
 * GHSA-57hw-jqpj-ww97: `GET /invoices/highest` returned MAX(invoiceNumber) over the whole
 * installation, so any tenant could read other tenants' invoice sequence. These tests run the real
 * service method against a real SQLite database (TypeORM branch and the MikroORM/knex branch) and
 * keep the pre-fix query shape next to it as the control.
 */

const TENANT_A = '6b6c8a5e-0b0a-4e2b-9d1a-0f1f2a3b4c5d';
const TENANT_B = '9f0e1d2c-3b4a-4958-8a7b-6c5d4e3f2a1b';

interface InvoiceRow {
	id: string;
	tenantId: string | null;
	invoiceNumber: number | null;
}

/** Just the columns the aggregate reads, under the real table name. */
const InvoiceSchema = new EntitySchema<InvoiceRow>({
	name: 'invoice',
	tableName: 'invoice',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		invoiceNumber: { type: 'numeric', nullable: true }
	}
});

describe('InvoiceService.getHighestInvoiceNumber (GHSA-57hw-jqpj-ww97)', () => {
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
		dbPath = path.join(os.tmpdir(), `gauzy-invoice-number-${process.pid}-${Date.now()}.sqlite3`);
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
			{ id: 'a-1', tenantId: TENANT_A, invoiceNumber: 99 },
			{ id: 'a-2', tenantId: TENANT_A, invoiceNumber: 100 },
			{ id: 'b-1', tenantId: TENANT_B, invoiceNumber: 5000 }
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

	describe('control: the pre-fix query shapes', () => {
		it('TypeORM: an unscoped MAX returns the other tenant’s number', async () => {
			const query = repository.createQueryBuilder('invoice');
			const result = await query.select(`COALESCE(MAX(${query.alias}.invoiceNumber), 0)`, 'max').getRawOne();
			expect(Number(result.max)).toBe(5000);
		});

		it('knex: an unscoped MAX returns the other tenant’s number', async () => {
			const result = await knexClient('invoice').max('invoiceNumber as max').first();
			expect(Number(result?.max)).toBe(5000);
		});
	});

	describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('%s branch', (ormType) => {
		it('returns the highest number of the caller’s tenant only', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
			const result: any = await serviceFor(ormType).getHighestInvoiceNumber();
			expect(Number(result.max)).toBe(100);
		});

		it('returns the other tenant’s own maximum for that tenant', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_B);
			const result: any = await serviceFor(ormType).getHighestInvoiceNumber();
			expect(Number(result.max)).toBe(5000);
		});

		it('returns 0 for a tenant with no invoices yet', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('00000000-0000-4000-8000-000000000000');
			const result: any = await serviceFor(ormType).getHighestInvoiceNumber();
			expect(Number(result.max ?? 0)).toBe(0);
		});

		it('fails closed without a tenant in the request context', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
			await expect(serviceFor(ormType).getHighestInvoiceNumber()).rejects.toBeInstanceOf(ForbiddenException);
		});
	});
});

describe('Invoice entity: invoice numbers are unique per tenant (GHSA-57hw-jqpj-ww97)', () => {
	it('declares UNIQUE(tenantId, invoiceNumber) and no installation-wide UNIQUE(invoiceNumber)', () => {
		const uniques = getMetadataArgsStorage().uniques.filter((unique) => unique.target === Invoice);
		const columnSets = uniques.map((unique) => unique.columns);

		expect(columnSets).toContainEqual(['tenantId', 'invoiceNumber']);
		expect(columnSets).not.toContainEqual(['invoiceNumber']);
	});
});

describe('InvoiceDTO.invoiceNumber bounds', () => {
	const errorsFor = async (invoiceNumber: number) => {
		const dto = plainToInstance(InvoiceDTO, { invoiceNumber });
		const errors = await validate(dto);
		return errors.find((error) => error.property === 'invoiceNumber')?.constraints ?? {};
	};

	it('accepts an ordinary invoice number (control)', async () => {
		expect(await errorsFor(1001)).toEqual({});
	});

	it('rejects a number beyond Number.MAX_SAFE_INTEGER, which @IsNumber alone accepted', async () => {
		const constraints = await errorsFor(1e18);
		expect(constraints).not.toHaveProperty('isNumber');
		expect(constraints).toHaveProperty('max');
	});

	it('rejects a fractional number, which @IsNumber alone accepted', async () => {
		// `numeric` keeps the fraction while MySQL's `bigint` truncates it, so MAX(...) + 1 would
		// mean something different per database.
		expect(await errorsFor(1000.5)).toHaveProperty('isInt');
	});
});
