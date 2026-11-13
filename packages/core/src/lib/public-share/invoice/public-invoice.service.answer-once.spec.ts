import '../../core/entities/internal';

import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { signPurposeToken, TokenPurposeEnum } from '../../auth/purpose-token';
import { PublicInvoiceService } from './public-invoice.service';

/**
 * A client's answer to an estimate is written only when it changes the estimate's status, and the update's `affected`
 * count says so: the answer that changed it is the one the team is told of (`PublicInvoiceUpdateHandler`), once, even
 * when the same answer arrives twice at the same moment. Where the organization converts accepted estimates, the
 * acceptance turns the estimate into a draft invoice, once, whatever its status. Runs on a real better-sqlite3 database.
 */

const InvoiceSchema = new EntitySchema({
	name: 'AnswerOnceSpecInvoice',
	tableName: 'answer_once_spec_invoice',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		status: { type: 'varchar', nullable: true },
		isEstimate: { type: 'boolean', nullable: true }
	}
});

const EstimateEmailSchema = new EntitySchema({
	name: 'AnswerOnceSpecEstimateEmail',
	tableName: 'answer_once_spec_estimate_email',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		token: { type: 'text' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		expireDate: { type: 'datetime' }
	}
});

const TENANT = '22222222-2222-4222-8222-222222222222';
const ORGANIZATION = 'org-b';
const ESTIMATE = 'estimate-1';

let dataSource: DataSource;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let invoices: Repository<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let estimateEmails: Repository<any>;
let service: PublicInvoiceService;
let token: string;

const answer = (status: string) =>
	service.updateInvoice({ id: ESTIMATE, token } as never, { status } as never) as Promise<{ affected?: number }>;

const statusNow = async () => (await invoices.findOneBy({ id: ESTIMATE })).status;

/** The acceptance the public page sends where the organization converts accepted estimates. */
const acceptAndConvert = () =>
	service.updateInvoice(
		{ id: ESTIMATE, token } as never,
		{ status: 'DRAFT', isEstimate: false } as never
	) as Promise<{
		affected?: number;
	}>;

const documentNow = async () => {
	const { status, isEstimate } = await invoices.findOneBy({ id: ESTIMATE });
	return { status, isEstimate };
};

beforeAll(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [InvoiceSchema, EstimateEmailSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	invoices = dataSource.getRepository('AnswerOnceSpecInvoice');
	estimateEmails = dataSource.getRepository('AnswerOnceSpecEstimateEmail');

	// The service's reads name relations the spec table does not have: forward the where only, and the update as is
	const invoiceRepository = {
		findOneByOrFail: (where: object) => invoices.findOneByOrFail(where),
		update: (criteria: object, entity: object) => invoices.update(criteria, entity)
	};
	service = new PublicInvoiceService(invoiceRepository as never, estimateEmails as never);
});

beforeEach(async () => {
	await invoices.clear();
	await estimateEmails.clear();
	token = signPurposeToken(
		TokenPurposeEnum.ESTIMATE,
		{ invoiceId: ESTIMATE, organizationId: ORGANIZATION, tenantId: TENANT, email: 'billing@acme.test' },
		{ expiresIn: '7d' }
	);
	await estimateEmails.save({
		token,
		email: 'billing@acme.test',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		expireDate: new Date(Date.now() + 7 * 24 * 3600 * 1000)
	});
	await invoices.save({
		id: ESTIMATE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		status: 'SENT',
		isEstimate: true
	});
});

afterAll(async () => {
	await dataSource?.destroy();
});

describe('PublicInvoiceService.updateInvoice, a client answer to an estimate', () => {
	it('changes the estimate once: the same answer again changes no row', async () => {
		await expect(answer('ACCEPTED')).resolves.toMatchObject({ affected: 1 });
		await expect(answer('ACCEPTED')).resolves.toMatchObject({ affected: 0 });

		expect(await statusNow()).toBe('ACCEPTED');
	});

	it('changes it once when the same answer arrives twice at the same moment', async () => {
		const results = await Promise.all([answer('ACCEPTED'), answer('ACCEPTED')]);

		expect(results.map((result) => result.affected).sort()).toEqual([0, 1]);
		expect(await statusNow()).toBe('ACCEPTED');
	});

	it('still writes an answer over an estimate stored with no status', async () => {
		await invoices.update({ id: ESTIMATE }, { status: null });

		await expect(answer('REJECTED')).resolves.toMatchObject({ affected: 1 });

		expect(await statusNow()).toBe('REJECTED');
	});

	it('writes a different answer, as before', async () => {
		await answer('ACCEPTED');

		await expect(answer('REJECTED')).resolves.toMatchObject({ affected: 1 });

		expect(await statusNow()).toBe('REJECTED');
	});
});

describe('PublicInvoiceService.updateInvoice, an acceptance where the organization converts accepted estimates', () => {
	it('turns an estimate still in DRAFT into a draft invoice, as before', async () => {
		await invoices.update({ id: ESTIMATE }, { status: 'DRAFT' });

		await expect(acceptAndConvert()).resolves.toMatchObject({ affected: 1 });

		expect(await documentNow()).toEqual({ status: 'DRAFT', isEstimate: false });
	});

	it('turns a sent estimate into a draft invoice once: converting it again changes no row', async () => {
		await expect(acceptAndConvert()).resolves.toMatchObject({ affected: 1 });
		await expect(acceptAndConvert()).resolves.toMatchObject({ affected: 0 });

		expect(await documentNow()).toEqual({ status: 'DRAFT', isEstimate: false });
	});

	it('converts it once when the acceptance arrives twice at the same moment', async () => {
		const results = await Promise.all([acceptAndConvert(), acceptAndConvert()]);

		expect(results.map((result) => result.affected).sort()).toEqual([0, 1]);
		expect(await documentNow()).toEqual({ status: 'DRAFT', isEstimate: false });
	});

	it('still converts a document stored with no estimate flag, as before', async () => {
		await invoices.update({ id: ESTIMATE }, { isEstimate: null });

		await expect(acceptAndConvert()).resolves.toMatchObject({ affected: 1 });

		expect(await documentNow()).toEqual({ status: 'DRAFT', isEstimate: false });
	});
});
