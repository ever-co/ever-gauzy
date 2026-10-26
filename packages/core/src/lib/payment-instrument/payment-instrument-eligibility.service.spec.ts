/**
 * The remembered payer, asked one question: may this payer be charged, and with what?
 *
 * The suite walks the resolver's guards in the order they run — the account's status first, then the
 * instrument's, then the mandate a recurring debit needs, then the currency — and asserts the thing the
 * whole stored-instrument model exists for: **a recurring-debit instrument whose account carries no
 * mandate is not chargeable, and an active card on the same mandate-free account is.** A refusal is a
 * normal answer here, so every case asserts the returned `chargeable` and `reasonCode` rather than an
 * exception.
 *
 * The base CRUD class is doubled, and the two services under test are the real ones over an in-memory
 * pair of tables, with the resolver composed exactly as the module composes it.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async softDelete(id: any): Promise<any> {
			return this.typeOrmRepository.update(id, { deletedAt: new Date() });
		}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ApiErrorCode } from '../core/errors/api-error-codes';
import {
	PaymentAccountHolderStatus,
	PaymentInstrumentRefusalReason,
	PaymentMethodTokenStatus,
	PaymentMethodTokenType
} from '@gauzy/contracts';
import { PaymentAccountHolder } from '../payment-account-holder/payment-account-holder.entity';
import { PaymentAccountHolderService } from '../payment-account-holder/payment-account-holder.service';
import { PaymentMethodToken } from '../payment-method-token/payment-method-token.entity';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';
import { PaymentInstrumentEligibilityService } from './payment-instrument-eligibility.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const HOLDER = 'holder-1';
const OTHER_HOLDER = 'holder-2';
const PROVIDER = 'acme-pay';
const EXTERNAL = 'acct-provider-1';
const MANDATE = { mandateReference: 'mandate-1', mandateAcceptedAt: new Date('2026-03-01T10:00:00.000Z') };

type Row = Record<string, any>;

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[PaymentAccountHolder, 'payment_account_holder'],
	[PaymentMethodToken, 'payment_method_token']
]);

/**
 * An in-memory stand-in for the two tables and the transaction manager they are written through. The
 * `where` the service states is applied, so a read that stopped narrowing is caught here.
 */
function world(seed: { holders?: Row[]; tokens?: Row[] } = {}) {
	const tables: Record<string, Row[]> = {
		payment_account_holder: [...(seed.holders ?? [])],
		payment_method_token: [...(seed.tokens ?? [])]
	};
	let sequence = 0;

	const tableOf = (entity: unknown): string => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const save = (table: string, row: Row): Row => {
		if (row.id) {
			const index = tables[table].findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables[table][index] = { ...tables[table][index], ...row };

				return tables[table][index];
			}
		}

		const created = { id: `${table}-${++sequence}`, createdAt: new Date(), ...row };

		tables[table].push(created);

		return created;
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rows: Row | Row[]) => {
			const list = Array.isArray(rows) ? rows : [rows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
		createQueryBuilder: (entity: unknown, _alias: string) => {
			const conditions: Row[] = [];
			const builder: any = {
				where: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				andWhere: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				setLock: () => builder,
				getOne: async () =>
					tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null
			};

			return builder;
		}
	};

	const repository = (table: string) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables[table].filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables[table].find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables[table].find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save(table, row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[table].findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	});

	return {
		tables,
		holderRepository: repository('payment_account_holder'),
		tokenRepository: repository('payment_method_token')
	};
}

/** One `payment_account_holder` row, with the fields this suite reads. */
const holderRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	contactId: 'contact-1',
	providerKey: PROVIDER,
	paymentProviderId: 'provider-registration-1',
	type: 'CUSTOMER',
	status: PaymentAccountHolderStatus.ACTIVE,
	verificationStatus: 'UNVERIFIED',
	externalAccountId: EXTERNAL,
	...overrides
});

/** One `payment_method_token` row, with the fields this suite reads. */
const tokenRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	accountHolderId: HOLDER,
	paymentProviderId: 'provider-registration-1',
	providerKey: PROVIDER,
	token: `tok-${id}`,
	type: PaymentMethodTokenType.CARD,
	status: PaymentMethodTokenStatus.ACTIVE,
	isDefault: false,
	...overrides
});

/** The resolver under test, over the two real services and one in-memory world. */
function instruments(seed: { holders?: Row[]; tokens?: Row[] } = {}) {
	const store = world({ holders: seed.holders ?? [holderRow(HOLDER)], tokens: seed.tokens ?? [] });
	const tokenService = new PaymentMethodTokenService(
		store.tokenRepository as never,
		{} as never,
		store.holderRepository as never
	);
	const holderService = new PaymentAccountHolderService(
		store.holderRepository as never,
		{} as never,
		tokenService
	);
	const eligibility = new PaymentInstrumentEligibilityService(holderService, tokenService);

	return { ...store, eligibility, holderService, tokenService };
}

describe('PaymentInstrumentEligibilityService — the case the stored-instrument model exists for', () => {
	it('refuses a recurring debit whose account carries no mandate', async () => {
		const { eligibility } = instruments({
			tokens: [tokenRow('token-dd', { type: PaymentMethodTokenType.DIRECT_DEBIT, isDefault: true })]
		});

		const answer = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			currency: 'EUR'
		});

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED);
		expect(answer.reason).toContain(PaymentInstrumentRefusalReason.MANDATE_MISSING);
		expect(answer.accountHolderId).toBe(HOLDER);
		expect(answer.paymentMethodTokenId).toBe('token-dd');
	});

	it('allows an active card on the same mandate-free account', async () => {
		const { eligibility } = instruments({
			tokens: [tokenRow('token-card', { type: PaymentMethodTokenType.CARD, isDefault: true })]
		});

		const answer = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			currency: 'EUR'
		});

		expect(answer).toEqual({ accountHolderId: HOLDER, paymentMethodTokenId: 'token-card', chargeable: true });
	});

	it('allows the same recurring debit once the account carries the mandate', async () => {
		const { eligibility } = instruments({
			holders: [holderRow(HOLDER, MANDATE)],
			tokens: [tokenRow('token-dd', { type: PaymentMethodTokenType.DIRECT_DEBIT, isDefault: true })]
		});

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(answer.chargeable).toBe(true);
		expect(answer.paymentMethodTokenId).toBe('token-dd');
	});

	it('refuses a recurring debit whose account carries only half a mandate', async () => {
		const { eligibility } = instruments({
			holders: [holderRow(HOLDER, { mandateReference: 'mandate-1' })],
			tokens: [tokenRow('token-dd', { type: PaymentMethodTokenType.DIRECT_DEBIT, isDefault: true })]
		});

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED);
		expect(answer.reason).toContain(PaymentInstrumentRefusalReason.MANDATE_MISSING);
	});
});

describe('PaymentInstrumentEligibilityService — the account guard runs first', () => {
	it('refuses every status but ACTIVE with the restricted code', async () => {
		for (const status of [
			PaymentAccountHolderStatus.PENDING,
			PaymentAccountHolderStatus.RESTRICTED,
			PaymentAccountHolderStatus.REJECTED,
			PaymentAccountHolderStatus.DISABLED
		]) {
			const { eligibility } = instruments({
				holders: [holderRow(HOLDER, { status })],
				tokens: [tokenRow('token-1')]
			});

			const answer = await eligibility.resolveChargeableInstrument({
				accountHolderId: HOLDER,
				paymentMethodTokenId: 'token-1',
				currency: 'EUR'
			});

			expect(answer.chargeable).toBe(false);
			expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_RESTRICTED);
		}
	});

	it('refuses a payer that does not exist, and one of another organization', async () => {
		const { eligibility } = instruments({ holders: [holderRow(HOLDER, { organizationId: 'elsewhere' })] });

		const missing = await eligibility.resolveChargeableInstrument({ accountHolderId: 'nobody', currency: 'EUR' });

		expect(missing.chargeable).toBe(false);
		expect(missing.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND);

		const foreign = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(foreign.chargeable).toBe(false);
		expect(foreign.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND);

		const unnamed = await eligibility.resolveChargeableInstrument({ currency: 'EUR' });

		expect(unnamed.chargeable).toBe(false);
		expect(unnamed.reasonCode).toBe(ApiErrorCode.PAYMENT_ACCOUNT_HOLDER_NOT_FOUND);
	});

	it('answers with a refusal rather than raising when the charge states no currency', async () => {
		const { eligibility } = instruments({ tokens: [tokenRow('token-1', { isDefault: true })] });

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER } as never);

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED);
	});
});

describe('PaymentInstrumentEligibilityService — the instrument guard names the state it found', () => {
	it('refuses a removed instrument', async () => {
		const { eligibility } = instruments({
			tokens: [tokenRow('token-1', { status: PaymentMethodTokenStatus.REVOKED })]
		});

		const answer = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			paymentMethodTokenId: 'token-1',
			currency: 'EUR'
		});

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_TOKEN_REVOKED);
		expect(answer.paymentMethodTokenId).toBe('token-1');
	});

	it('refuses an expired instrument', async () => {
		const { eligibility } = instruments({
			tokens: [tokenRow('token-1', { status: PaymentMethodTokenStatus.EXPIRED })]
		});

		const answer = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			paymentMethodTokenId: 'token-1',
			currency: 'EUR'
		});

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_TOKEN_EXPIRED);
	});

	it('refuses an instrument the provider refused', async () => {
		const { eligibility } = instruments({
			tokens: [tokenRow('token-1', { status: PaymentMethodTokenStatus.FAILED })]
		});

		const answer = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			paymentMethodTokenId: 'token-1',
			currency: 'EUR'
		});

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED);
	});

	it('refuses an instrument that does not exist, and one that belongs to another account', async () => {
		const { eligibility } = instruments({
			holders: [holderRow(HOLDER), holderRow(OTHER_HOLDER, { contactId: 'contact-2' })],
			tokens: [tokenRow('token-1', { accountHolderId: OTHER_HOLDER })]
		});

		const missing = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			paymentMethodTokenId: 'nobody',
			currency: 'EUR'
		});

		expect(missing.chargeable).toBe(false);
		expect(missing.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND);

		const foreign = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			paymentMethodTokenId: 'token-1',
			currency: 'EUR'
		});

		expect(foreign.chargeable).toBe(false);
		expect(foreign.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED);
		expect(foreign.reason).toContain(PaymentInstrumentRefusalReason.INSTRUMENT_NOT_OF_HOLDER);
	});

	it('resolves the account from the named instrument when the charge names no account', async () => {
		const { eligibility } = instruments({ tokens: [tokenRow('token-1')] });

		const answer = await eligibility.resolveChargeableInstrument({
			paymentMethodTokenId: 'token-1',
			currency: 'EUR'
		});

		expect(answer).toEqual({ accountHolderId: HOLDER, paymentMethodTokenId: 'token-1', chargeable: true });
	});
});

describe('PaymentInstrumentEligibilityService — the default instrument of the account', () => {
	it('answers with a refusal when the account holds no default of the kind asked for', async () => {
		const { eligibility } = instruments({ tokens: [tokenRow('token-1')] });

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_TOKEN_NOT_FOUND);
		expect(answer.reason).toContain(PaymentInstrumentRefusalReason.NO_DEFAULT_INSTRUMENT);
	});

	it('resolves the default of the kind the charge names', async () => {
		const { eligibility } = instruments({
			tokens: [
				tokenRow('token-card', { isDefault: true }),
				tokenRow('token-bank', {
					type: PaymentMethodTokenType.BANK_ACCOUNT,
					isDefault: true,
					token: 'tok-bank'
				})
			]
		});

		const card = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			currency: 'EUR',
			type: PaymentMethodTokenType.CARD
		});
		const bank = await eligibility.resolveChargeableInstrument({
			accountHolderId: HOLDER,
			currency: 'EUR',
			type: PaymentMethodTokenType.BANK_ACCOUNT
		});

		expect(card.paymentMethodTokenId).toBe('token-card');
		expect(card.chargeable).toBe(true);
		expect(bank.paymentMethodTokenId).toBe('token-bank');
		expect(bank.chargeable).toBe(true);
	});

	it('charges the one chargeable default when the charge names no kind', async () => {
		const { eligibility } = instruments({
			tokens: [
				tokenRow('token-card', { isDefault: true }),
				tokenRow('token-bank', {
					type: PaymentMethodTokenType.BANK_ACCOUNT,
					isDefault: true,
					token: 'tok-bank',
					status: PaymentMethodTokenStatus.EXPIRED
				})
			]
		});

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(answer.paymentMethodTokenId).toBe('token-card');
		expect(answer.chargeable).toBe(true);
	});

	it('refuses rather than guessing when the account holds several usable defaults', async () => {
		const { eligibility } = instruments({
			tokens: [
				tokenRow('token-card', { isDefault: true }),
				tokenRow('token-bank', {
					type: PaymentMethodTokenType.BANK_ACCOUNT,
					isDefault: true,
					token: 'tok-bank'
				})
			]
		});

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'EUR' });

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_METHOD_VALIDATION_FAILED);
		expect(answer.reason).toContain(PaymentInstrumentRefusalReason.AMBIGUOUS_DEFAULT_INSTRUMENT);
	});
});

describe('PaymentInstrumentEligibilityService — the currency the account settles in', () => {
	it('refuses a charge whose currency contradicts the account', async () => {
		const { eligibility } = instruments({
			holders: [holderRow(HOLDER, { defaultCurrency: 'USD' })],
			tokens: [tokenRow('token-1', { isDefault: true })]
		});

		const answer = await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'eur' });

		expect(answer.chargeable).toBe(false);
		expect(answer.reasonCode).toBe(ApiErrorCode.PAYMENT_CURRENCY_MISMATCH);
		expect(answer.reason).toContain(PaymentInstrumentRefusalReason.CURRENCY_MISMATCH);
	});

	it('accepts a currency stated in another case, and accepts any currency when the account states none', async () => {
		const { eligibility } = instruments({
			holders: [holderRow(HOLDER, { defaultCurrency: 'USD' })],
			tokens: [tokenRow('token-1', { isDefault: true })]
		});

		expect(
			(await eligibility.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'usd' })).chargeable
		).toBe(true);

		const { eligibility: unstated } = instruments({ tokens: [tokenRow('token-1', { isDefault: true })] });

		expect(
			(await unstated.resolveChargeableInstrument({ accountHolderId: HOLDER, currency: 'JPY' })).chargeable
		).toBe(true);
	});
});
