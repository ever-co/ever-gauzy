import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { environment, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { instanceToPlain } from 'class-transformer';
import { sign, verify } from 'jsonwebtoken';
import { DataSource, EntitySchema, MoreThan, Repository } from 'typeorm';
import { signPurposeToken, TokenPurposeEnum } from '../auth/purpose-token';
import { EstimateEmail } from './estimate-email.entity';
import { EstimateEmailService } from './estimate-email.service';

/**
 * GHSA-28wv-vrxj-rp4q — public GET /estimate-email/validate.
 *
 * The pre-fix code destructured a `token` claim that is never minted and ignored the query email,
 * so with any other JWT_SECRET token (an appointment token, say) the lookup collapsed to
 * `expireDate > now` and returned ANOTHER tenant's live estimate email, token included. That token
 * then drove the public PUT that accepts or rejects the estimate.
 */

const EstimateEmailSchema = new EntitySchema({
	name: 'EstimateEmailSpecRow',
	tableName: 'estimate_email_spec_row',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		token: { type: 'text' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		expireDate: { type: 'datetime' },
		convertAcceptedEstimates: { type: 'boolean', nullable: true }
	}
});

const TENANT_B = '22222222-2222-4222-8222-222222222222';
const ORG_B = 'org-b';
const CUSTOMER = 'customer@acme.co';

let dataSource: DataSource;
let rows: Repository<any>;
let service: EstimateEmailService;

const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600 * 1000);

const estimateToken = (claims: Record<string, unknown> = {}) =>
	signPurposeToken(
		TokenPurposeEnum.ESTIMATE,
		{ invoiceId: 'inv-1', organizationId: ORG_B, tenantId: TENANT_B, email: CUSTOMER, ...claims },
		{ expiresIn: '7d' }
	);

beforeAll(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [EstimateEmailSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	rows = dataSource.getRepository('EstimateEmailSpecRow');

	service = Object.create(EstimateEmailService.prototype);
	Object.assign(service, {
		// The service passes `select` / `relations` the spec table does not have; forward the where
		// only. Public route: TenantAwareCrudService passes the where through unchanged.
		findOneOrFailByOptions: async ({ where }) => {
			try {
				return { success: true, record: await rows.findOneOrFail({ where }) };
			} catch (error) {
				return { success: false, error };
			}
		}
	});
});

beforeEach(async () => {
	await rows.clear();
});

afterAll(async () => {
	await dataSource?.destroy();
});

describe('EstimateEmailService.validate (GHSA-28wv-vrxj-rp4q)', () => {
	it('returns the estimate email for its own token and email', async () => {
		const token = estimateToken();
		await rows.save({
			token,
			email: CUSTOMER,
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate: inAWeek(),
			convertAcceptedEstimates: true
		});

		await expect(service.validate({ email: CUSTOMER, token })).resolves.toMatchObject({
			convertAcceptedEstimates: true
		});
	});

	it('accepts a legacy (untyped) estimate token bound to its stored row', async () => {
		const legacy = sign(
			{ invoiceId: 'inv-1', organizationId: ORG_B, tenantId: TENANT_B, email: CUSTOMER },
			environment.JWT_SECRET
		);
		await rows.save({
			token: legacy,
			email: CUSTOMER,
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate: inAWeek()
		});

		await expect(service.validate({ email: 'Customer@Acme.co', token: legacy })).resolves.toMatchObject({
			email: CUSTOMER
		});
	});

	it("rejects an appointment token — CONTROL: the pre-fix lookup returned another tenant's row", async () => {
		const victimToken = estimateToken();
		await rows.save({
			token: victimToken,
			email: CUSTOMER,
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate: inAWeek()
		});
		const appointment = sign({ appointmentId: 'a1' }, environment.JWT_SECRET);

		// CONTROL: the pre-fix where, built from the (absent) claims.
		const { email, token, organizationId, tenantId } = verify(appointment, environment.JWT_SECRET) as any;
		const leaked = await rows.findOne({
			where: { email, token, organizationId, tenantId, expireDate: MoreThan(new Date()) }
		});
		expect(leaked.token).toBe(victimToken);

		await expect(service.validate({ email: 'attacker@evil.co', token: appointment })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('rejects an estimate token presented with a different email', async () => {
		const token = estimateToken();
		await rows.save({ token, email: CUSTOMER, tenantId: TENANT_B, organizationId: ORG_B, expireDate: inAWeek() });

		await expect(service.validate({ email: 'attacker@evil.co', token })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('revokes a superseded token once the estimate is re-sent — CONTROL: the claims-only where still matched', async () => {
		const oldToken = estimateToken({ nonce: 'first' });
		const newToken = estimateToken({ nonce: 'second' });
		// The estimate was re-sent: the stored row now carries the NEW token.
		await rows.save({
			token: newToken,
			email: CUSTOMER,
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate: inAWeek()
		});

		// CONTROL: without the stored-token predicate the claims of the OLD token still select the row —
		// and the response used to carry the row's current token with it.
		const stillMatched = await rows.findOne({
			where: { email: CUSTOMER, organizationId: ORG_B, tenantId: TENANT_B, expireDate: MoreThan(new Date()) }
		});
		expect(stillMatched.token).toBe(newToken);

		await expect(service.validate({ email: CUSTOMER, token: oldToken })).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(service.validate({ email: CUSTOMER, token: newToken })).resolves.toMatchObject({
			email: CUSTOMER
		});
	});

	it('rejects a valid token whose row is gone or expired', async () => {
		const token = estimateToken();
		await expect(service.validate({ email: CUSTOMER, token })).rejects.toBeInstanceOf(BadRequestException);

		await rows.save({
			token,
			email: CUSTOMER,
			tenantId: TENANT_B,
			organizationId: ORG_B,
			expireDate: new Date(Date.now() - 1000)
		});
		await expect(service.validate({ email: CUSTOMER, token })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('rejects a typed estimate token that lacks a required claim', async () => {
		const token = estimateToken({ organizationId: undefined });
		await rows.save({ token, email: CUSTOMER, tenantId: TENANT_B, organizationId: ORG_B, expireDate: inAWeek() });
		await expect(service.validate({ email: CUSTOMER, token })).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('EstimateEmail.token serialization', () => {
	it('is never serialised — CONTROL: the entity instance still carries it for the mailer', () => {
		const entity = new EstimateEmail({ token: 'secret-token', email: CUSTOMER } as any);

		expect(entity.token).toBe('secret-token');
		expect(instanceToPlain(entity)).not.toHaveProperty('token');
		expect(instanceToPlain(entity)).toMatchObject({ email: CUSTOMER });
	});
});
