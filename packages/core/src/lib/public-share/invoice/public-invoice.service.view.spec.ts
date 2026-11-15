import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { signPurposeToken, TokenPurposeEnum } from '../../auth/purpose-token';
import { PublicInvoiceService } from './public-invoice.service';

/**
 * The public page of an invoice (ever-co/ever-gauzy#11856): the link in the invoice's email opens it without an account.
 *
 * - Opening it marks a sent invoice Viewed, and nothing else: a status set meanwhile is never written over.
 * - A voided invoice's link no longer opens it, and neither does a revoked one.
 *
 * Runs against a real SQLite database with the shipped where-value behaviour, as `public-invoice.service.spec.ts` does.
 */

const InvoiceSchema = new EntitySchema({
	name: 'PublicInvoiceViewSpecInvoice',
	tableName: 'public_invoice_view_spec_invoice',
	columns: {
		id: { primary: true, type: 'varchar' },
		token: { type: 'text', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		status: { type: 'varchar', nullable: true },
		isEstimate: { type: 'boolean', nullable: true },
		internalNote: { type: 'text', nullable: true }
	}
});

const TENANT = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION = 'organization-1';

let dataSource: DataSource;
let invoices: Repository<any>;
let update: jest.Mock;
let service: PublicInvoiceService;

const shareToken = (id: string) =>
	signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, { id, organizationId: ORGANIZATION, tenantId: TENANT });

/** Stores an invoice with its share token and answers the token. */
async function stored(id: string, fields: Record<string, unknown>): Promise<string> {
	const token = shareToken(id);
	await invoices.save({ id, tenantId: TENANT, organizationId: ORGANIZATION, token, ...fields });
	return token;
}

const statusOf = async (id: string) => (await invoices.findOneBy({ id })).status;

beforeAll(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [InvoiceSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	invoices = dataSource.getRepository('PublicInvoiceViewSpecInvoice');
});

beforeEach(async () => {
	await invoices.clear();
	update = jest.fn((criteria, values) => invoices.update(criteria, values));
	// The read passes `select` / `relations` the spec table does not have; forward the where only.
	const invoiceRepository = {
		findOneOrFail: ({ where }) => invoices.findOneOrFail({ where }),
		update,
		manager: dataSource.manager,
		target: invoices.target
	};
	service = new PublicInvoiceService(invoiceRepository as any, {} as any);
});

afterAll(async () => {
	await dataSource?.destroy();
});

describe('PublicInvoiceService.findOneByConditions — opening the link marks the invoice Viewed', () => {
	it('marks a sent invoice Viewed, and serves it Viewed', async () => {
		const token = await stored('invoice-sent', { status: 'SENT', isEstimate: false });

		await expect(service.findOneByConditions({ id: 'invoice-sent', token })).resolves.toMatchObject({
			id: 'invoice-sent',
			status: 'VIEWED'
		});
		expect(await statusOf('invoice-sent')).toBe('VIEWED');
	});

	it('marks a sent estimate Viewed', async () => {
		const token = await stored('estimate-sent', { status: 'SENT', isEstimate: true });

		await service.findOneByConditions({ id: 'estimate-sent', token });

		expect(await statusOf('estimate-sent')).toBe('VIEWED');
	});

	it.each(['DRAFT', 'VIEWED', 'PARTIALLY_PAID', 'FULLY_PAID', 'OVERPAID'])(
		'leaves a %s invoice as it is',
		async (status) => {
			const token = await stored('invoice-other', { status, isEstimate: false });

			await expect(service.findOneByConditions({ id: 'invoice-other', token })).resolves.toMatchObject({
				status
			});
			expect(await statusOf('invoice-other')).toBe(status);
			expect(update).not.toHaveBeenCalled();
		}
	);

	it('never writes over a status set between the read and the write (a payment recorded meanwhile)', async () => {
		const token = await stored('invoice-race', { status: 'SENT', isEstimate: false });
		update.mockImplementationOnce(async (criteria, values) => {
			// The invoice is paid in full just before the link's write lands
			await invoices.update('invoice-race', { status: 'FULLY_PAID' });
			return invoices.update(criteria, values);
		});

		const served = await service.findOneByConditions({ id: 'invoice-race', token });

		expect(await statusOf('invoice-race')).toBe('FULLY_PAID');
		expect(served.status).toBe('SENT');
	});

	it('still serves the invoice when the write fails', async () => {
		const token = await stored('invoice-write-fails', { status: 'SENT', isEstimate: false });
		update.mockRejectedValueOnce(new Error('database is locked'));

		await expect(service.findOneByConditions({ id: 'invoice-write-fails', token })).resolves.toMatchObject({
			id: 'invoice-write-fails',
			status: 'SENT'
		});
	});
});

describe('PublicInvoiceService.findOneByConditions — links that no longer open the invoice', () => {
	it("refuses a voided invoice's link — CONTROL: the token is the invoice's stored one", async () => {
		const token = await stored('invoice-void', { status: 'VOID', isEstimate: false });

		expect((await invoices.findOneBy({ id: 'invoice-void' })).token).toBe(token);

		await expect(service.findOneByConditions({ id: 'invoice-void', token })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(update).not.toHaveBeenCalled();
	});

	it('refuses a revoked link — CONTROL: it opened the invoice before the revocation', async () => {
		const token = await stored('invoice-revoked', { status: 'VIEWED', isEstimate: false });

		await expect(service.findOneByConditions({ id: 'invoice-revoked', token })).resolves.toMatchObject({
			id: 'invoice-revoked'
		});

		// What `DELETE /invoices/:id/link` writes
		await invoices.update('invoice-revoked', { token: null });

		await expect(service.findOneByConditions({ id: 'invoice-revoked', token })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});
});
