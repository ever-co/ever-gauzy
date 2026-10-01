import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InvoiceService } from '../invoice/invoice.service';
import { PaymentService } from '../payment/payment.service';

/**
 * The public `/stats/global` totals use raw knex under MikroORM, which bypasses the soft-delete filter
 * TypeORM's query builder applies, so deleted invoices / payments must be excluded explicitly.
 */
describe('Global invoice / payment stats exclude soft-deleted rows (MikroORM)', () => {
	let builder: Record<string, jest.Mock>;
	let knex: jest.Mock;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mikroOrmRepository = () => ({ getEntityManager: () => ({ getKnex: () => knex }) }) as any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const typeOrmRepository = { metadata: { tableName: 'stub' } } as any;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		builder = {
			where: jest.fn(),
			whereNull: jest.fn(),
			count: jest.fn(),
			sum: jest.fn(),
			first: jest.fn().mockResolvedValue({ count: '2', amount: '30.5' })
		};
		for (const method of ['where', 'whereNull', 'count', 'sum']) {
			builder[method].mockReturnValue(builder);
		}
		knex = jest.fn().mockReturnValue(builder);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('invoice stats filter out deleted invoices', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const stub = {} as any;
		const service = new InvoiceService(typeOrmRepository, mikroOrmRepository(), stub, stub, stub, stub, stub);

		await expect(service.getInvoiceStats()).resolves.toEqual({ count: 2, amount: 30.5 });
		expect(knex).toHaveBeenCalledWith('invoice');
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
	});

	it('payment stats filter out deleted payments', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = new PaymentService(typeOrmRepository, mikroOrmRepository(), {} as any);

		await expect(service.getPaymentStats()).resolves.toEqual({ count: 2, amount: 30.5 });
		expect(knex).toHaveBeenCalledWith('payment');
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
	});
});
