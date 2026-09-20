import '../../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { environment, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { sign, verify } from 'jsonwebtoken';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { signPurposeToken, TokenPurposeEnum } from '../../auth/purpose-token';
import { PublicInvoiceService } from './public-invoice.service';

/**
 * GHSA-28wv-vrxj-rp4q — public invoice links.
 *
 * GET /public/invoice/:id/:token verified the token against JWT_SECRET and then built the lookup
 * from its CLAIMS alone: the URL id was never used and the stored `invoice.token` never compared.
 * Any JWT_SECRET token of another kind dropped the missing claims (`undefined: 'ignore'`) and read
 * an arbitrary invoice; a rotated link kept working. The public PUT (estimate accept / reject) was
 * not bound to a live `estimate_email` row.
 *
 * Runs against a real better-sqlite3 database with the shipped where-value behavior. Every rejection
 * is paired with a CONTROL that runs the pre-fix lookup against the same rows.
 */

const InvoiceSchema = new EntitySchema({
	name: 'PublicInvoiceSpecInvoice',
	tableName: 'public_invoice_spec_invoice',
	columns: {
		id: { primary: true, type: 'varchar' },
		token: { type: 'text', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		status: { type: 'varchar', nullable: true }
	}
});

const EstimateEmailSchema = new EntitySchema({
	name: 'PublicInvoiceSpecEstimateEmail',
	tableName: 'public_invoice_spec_estimate_email',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		token: { type: 'text' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		expireDate: { type: 'datetime' }
	}
});

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ORG_B = 'org-b';

let dataSource: DataSource;
let invoices: Repository<any>;
let estimateEmails: Repository<any>;
let service: PublicInvoiceService;

const shareToken = (invoice: { id: string; organizationId: string; tenantId: string }) =>
	signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, {
		id: invoice.id,
		organizationId: invoice.organizationId,
		tenantId: invoice.tenantId
	});

/** The pre-fix GET lookup: claims only, no URL id, no stored token. */
async function preFixGet(token: string) {
	const { id, organizationId, tenantId } = verify(token, environment.JWT_SECRET) as any;
	return invoices.findOne({ where: { id, organizationId, tenantId } });
}

const FIRST = { id: 'inv-first', tenantId: TENANT_A, organizationId: 'org-a', status: 'SENT' };
const VICTIM = { id: 'inv-victim', tenantId: TENANT_B, organizationId: ORG_B, status: 'SENT' };
const OTHER = { id: 'inv-other', tenantId: TENANT_B, organizationId: ORG_B, status: 'SENT' };

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
	invoices = dataSource.getRepository('PublicInvoiceSpecInvoice');
	estimateEmails = dataSource.getRepository('PublicInvoiceSpecEstimateEmail');

	// The service passes `select` / `relations` the spec table does not have; forward the where only.
	const invoiceRepository = {
		findOneOrFail: ({ where }) => invoices.findOneOrFail({ where }),
		findOneByOrFail: (where) => invoices.findOneByOrFail(where),
		update: (id, entity) => invoices.update(id, entity)
	};
	service = new PublicInvoiceService(invoiceRepository as any, estimateEmails as any);
});

beforeEach(async () => {
	await invoices.clear();
	await estimateEmails.clear();
	await invoices.save([FIRST, VICTIM, OTHER].map((invoice) => ({ ...invoice, token: shareToken(invoice) })));
});

afterAll(async () => {
	await dataSource?.destroy();
});

const storedToken = async (id: string) => (await invoices.findOneBy({ id })).token as string;

describe('PublicInvoiceService.findOneByConditions (GET, GHSA-28wv-vrxj-rp4q)', () => {
	it('returns the invoice for its stored share token', async () => {
		const token = await storedToken(VICTIM.id);
		await expect(service.findOneByConditions({ id: VICTIM.id, token })).resolves.toMatchObject({ id: VICTIM.id });
	});

	it('keeps accepting a link mailed before share tokens were typed (it equals the stored token)', async () => {
		const legacy = sign({ id: VICTIM.id, organizationId: ORG_B, tenantId: TENANT_B }, environment.JWT_SECRET);
		await invoices.update(VICTIM.id, { token: legacy });
		await expect(service.findOneByConditions({ id: VICTIM.id, token: legacy })).resolves.toMatchObject({
			id: VICTIM.id
		});
	});

	it.each([
		[
			'an appointment token',
			() => signPurposeToken(TokenPurposeEnum.APPOINTMENT, { appointmentId: 'a1', tenantId: TENANT_A })
		],
		['a legacy appointment token', () => sign({ appointmentId: 'a1' }, environment.JWT_SECRET)],
		['a legacy invite token', () => sign({ email: 'x@y.z', code: 'C' }, environment.JWT_SECRET)],
		[
			'an estimate token',
			() =>
				sign(
					{ invoiceId: VICTIM.id, organizationId: ORG_B, tenantId: TENANT_B, email: 'c@d.e' },
					environment.JWT_SECRET
				)
		],
		[
			'a workspace token',
			() => sign({ userId: 'u', email: 'a@b.c', tenantId: TENANT_B, code: 'C' }, environment.JWT_SECRET)
		]
	])('rejects %s — CONTROL: the pre-fix lookup returned an invoice', async (_label, mint) => {
		const token = mint();

		await expect(preFixGet(token)).resolves.toBeTruthy();

		await expect(service.findOneByConditions({ id: VICTIM.id, token })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('rejects a share token for invoice B presented at the URL of invoice A — CONTROL: pre-fix ignored the URL id', async () => {
		const tokenForOther = await storedToken(OTHER.id);

		await expect(preFixGet(tokenForOther)).resolves.toMatchObject({ id: OTHER.id });

		await expect(service.findOneByConditions({ id: VICTIM.id, token: tokenForOther })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('revokes the old link once the share token is regenerated — CONTROL: pre-fix kept serving it', async () => {
		const oldToken = await storedToken(VICTIM.id);
		// Regenerate: a fresh token (distinct iat) replaces the stored one.
		await invoices.update(VICTIM.id, {
			token: signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, {
				id: VICTIM.id,
				organizationId: ORG_B,
				tenantId: TENANT_B,
				nonce: 'regenerated'
			})
		});

		await expect(preFixGet(oldToken)).resolves.toMatchObject({ id: VICTIM.id });

		await expect(service.findOneByConditions({ id: VICTIM.id, token: oldToken })).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('rejects a share token without a tenant claim, and a missing id or token', async () => {
		const noTenant = signPurposeToken(TokenPurposeEnum.INVOICE_SHARE, { id: VICTIM.id, organizationId: ORG_B });
		await invoices.update(VICTIM.id, { token: noTenant });
		await expect(service.findOneByConditions({ id: VICTIM.id, token: noTenant })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(service.findOneByConditions({ id: VICTIM.id, token: '' })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(service.findOneByConditions({ token: noTenant })).rejects.toBeInstanceOf(ForbiddenException);
	});
});

describe('PublicInvoiceService.updateInvoice (PUT estimate accept/reject, GHSA-28wv-vrxj-rp4q)', () => {
	const estimateToken = (claims: Record<string, unknown> = {}) =>
		signPurposeToken(
			TokenPurposeEnum.ESTIMATE,
			{ invoiceId: VICTIM.id, organizationId: ORG_B, tenantId: TENANT_B, email: 'customer@acme.co', ...claims },
			{ expiresIn: '7d' }
		);

	const storeEstimateEmail = (token: string, expireDate = new Date(Date.now() + 7 * 24 * 3600 * 1000)) =>
		estimateEmails.save({
			token,
			email: 'customer@acme.co',
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate
		});

	/** The pre-fix PUT checks: only the claims, no stored row. */
	const preFixPutAccepts = (token: string, id: string) => {
		const decoded: any = verify(token, environment.JWT_SECRET);
		return !!decoded?.invoiceId && !!decoded?.tenantId && decoded.invoiceId === id;
	};

	it('accepts the estimate for a live estimate email and updates only that invoice', async () => {
		const token = estimateToken();
		await storeEstimateEmail(token);

		await service.updateInvoice({ id: VICTIM.id, token } as any, { status: 'ACCEPTED' } as any);

		expect((await invoices.findOneBy({ id: VICTIM.id })).status).toBe('ACCEPTED');
		expect((await invoices.findOneBy({ id: OTHER.id })).status).toBe('SENT');
	});

	it('accepts a legacy (untyped) estimate token that matches its stored row', async () => {
		const legacy = sign(
			{ invoiceId: VICTIM.id, organizationId: ORG_B, tenantId: TENANT_B, email: 'customer@acme.co' },
			environment.JWT_SECRET
		);
		await storeEstimateEmail(legacy);

		await service.updateInvoice({ id: VICTIM.id, token: legacy } as any, { status: 'REJECTED' } as any);
		expect((await invoices.findOneBy({ id: VICTIM.id })).status).toBe('REJECTED');
	});

	it('rejects a token whose estimate email expired — CONTROL: the pre-fix claim checks passed', async () => {
		const token = estimateToken();
		await storeEstimateEmail(token, new Date(Date.now() - 1000));

		expect(preFixPutAccepts(token, VICTIM.id)).toBe(true);

		await expect(
			service.updateInvoice({ id: VICTIM.id, token } as any, { status: 'ACCEPTED' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect((await invoices.findOneBy({ id: VICTIM.id })).status).toBe('SENT');
	});

	it('rejects a token with no estimate email row (deleted / never sent) — CONTROL: the pre-fix claim checks passed', async () => {
		const token = estimateToken();

		expect(preFixPutAccepts(token, VICTIM.id)).toBe(true);

		await expect(
			service.updateInvoice({ id: VICTIM.id, token } as any, { status: 'ACCEPTED' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it.each([
		['an invoice share token', async () => storedToken(VICTIM.id)],
		['an appointment token', async () => signPurposeToken(TokenPurposeEnum.APPOINTMENT, { appointmentId: 'a' })],
		['an estimate token naming another invoice', async () => estimateToken({ invoiceId: OTHER.id })]
	])('rejects %s', async (_label, mint) => {
		const token = await mint();
		await storeEstimateEmail(token);
		await expect(
			service.updateInvoice({ id: VICTIM.id, token } as any, { status: 'ACCEPTED' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect((await invoices.findOneBy({ id: VICTIM.id })).status).toBe('SENT');
	});

	it('still reports a missing invoice as a bad request', async () => {
		const token = estimateToken({ invoiceId: 'inv-missing' });
		await storeEstimateEmail(token);
		await expect(
			service.updateInvoice({ id: 'inv-missing', token } as any, { status: 'ACCEPTED' } as any)
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
