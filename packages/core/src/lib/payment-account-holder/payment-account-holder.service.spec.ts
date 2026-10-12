/**
 * The account at the provider — the payer the platform remembers (schema chapter §3.19).
 *
 * Five rules, and the suite walks each of them: the status machine and its two terminal states, the
 * external account id that a pending account does not carry and a chargeable one must, the mandate that
 * is one fact in two halves, one live account per party, provider and role, and the closing account that
 * revokes its instruments in the same transaction.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole
 * application graph — a unit test pays for the narrowest surface the module under test touches. The
 * services under test are the real ones, over an in-memory table that applies the `where` the service
 * states, so a service that stopped scoping its reads is caught here rather than accommodated.
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
	// The suite runs as Postgres so the row lock the closing and activating paths take is the statement
	// a production deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import {
	PaymentAccountHolderStatus,
	PaymentAccountHolderType,
	PaymentAccountVerificationStatus
} from '@gauzy/contracts';
import { PaymentAccountHolder } from './payment-account-holder.entity';
import { PaymentAccountHolderService } from './payment-account-holder.service';
import { PaymentMethodToken } from '../payment-method-token/payment-method-token.entity';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CONTACT = 'contact-1';
const OTHER_CONTACT = 'contact-2';
const HOLDER = 'holder-1';
const OTHER_HOLDER = 'holder-2';
const PROVIDER = 'acme-pay';
const EXTERNAL = 'acct-provider-1';

type Row = Record<string, any>;

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[PaymentAccountHolder, 'payment_account_holder'],
	[PaymentMethodToken, 'payment_method_token']
]);

/**
 * An in-memory stand-in for the two tables and the transaction manager they are written through.
 *
 * The `where` the service states is applied — equality, with a missing column and a null column treated
 * as the same thing to the database — so a read that stopped narrowing is caught here. `order` is not
 * modelled: no case in this suite depends on the order of a list, and a double that sorted would be
 * asserting its own comparator.
 */
function world(seed: { holders?: Row[]; tokens?: Row[] } = {}) {
	const tables: Record<string, Row[]> = {
		payment_account_holder: [...(seed.holders ?? [])],
		payment_method_token: [...(seed.tokens ?? [])]
	};
	const locks: string[] = [];
	const statements: Array<Record<string, unknown>> = [];
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
		find: async (entity: unknown, options: any = {}) => {
			statements.push({ read: tableOf(entity), ...options.where });

			return tables[tableOf(entity)].filter((row) => matches(row, options.where));
		},
		findOne: async (entity: unknown, options: any = {}) => {
			statements.push({ readOne: tableOf(entity), ...options.where });

			return tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null;
		},
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
				setLock: (mode: string) => {
					locks.push(`${tableOf(entity)}:${mode}`);

					return builder;
				},
				getOne: async () => {
					statements.push({ lockedRead: tableOf(entity) });

					return tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null;
				}
			};

			return builder;
		}
	};

	const repository = (table: string) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		// A retired row is invisible to a read unless the read asks for it, exactly as TypeORM's
		// `@DeleteDateColumn` and MikroORM's soft-delete filter make it. A double that returned it anyway
		// hid the one defect a soft delete can have: a read-back after the delete that cannot see the row.
		find: async (options: any = {}) =>
			tables[table].filter((row) => (options.withDeleted || !row.deletedAt) && matches(row, options.where)),
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
		locks,
		statements,
		holderRepository: repository('payment_account_holder'),
		tokenRepository: repository('payment_method_token'),
		holder: (id: string = HOLDER) => tables.payment_account_holder.find((row) => row.id === id),
		token: (id: string) => tables.payment_method_token.find((row) => row.id === id)
	};
}

/** One `payment_account_holder` row, with the fields this suite reads. */
const holderRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	contactId: CONTACT,
	providerKey: PROVIDER,
	type: PaymentAccountHolderType.CUSTOMER,
	status: PaymentAccountHolderStatus.PENDING,
	verificationStatus: PaymentAccountVerificationStatus.UNVERIFIED,
	...overrides
});

/** One `payment_method_token` row, with the fields this suite reads. */
const tokenRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	accountHolderId: HOLDER,
	providerKey: PROVIDER,
	token: `tok-${id}`,
	type: 'CARD',
	status: 'ACTIVE',
	isDefault: false,
	...overrides
});

/** The two services under test, over one in-memory world. */
function instruments(seed: { holders?: Row[]; tokens?: Row[] } = {}) {
	const store = world(seed);
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

	return { ...store, holderService, tokenService };
}

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('PaymentAccountHolderService — recording a party account at a provider', () => {
	it('creates the account PENDING, with the provider key it will stay addressable by', async () => {
		const { holderService, holder } = instruments();

		const created = await holderService.createHolder({
			contactId: CONTACT,
			providerKey: ` ${PROVIDER} `,
			type: PaymentAccountHolderType.SELLER,
			defaultCurrency: 'EUR'
		});

		expect(created.status).toBe(PaymentAccountHolderStatus.PENDING);
		expect(created.providerKey).toBe(PROVIDER);
		expect(created.type).toBe(PaymentAccountHolderType.SELLER);
		expect(created.verificationStatus).toBe(PaymentAccountVerificationStatus.UNVERIFIED);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(holder(created.id)).toBeDefined();
	});

	it('refuses a creation that states a lifecycle member the recording does not observe', async () => {
		const { holderService } = instruments();

		expect(
			await refusalOf(() =>
				holderService.createHolder({ providerKey: PROVIDER, externalAccountId: EXTERNAL } as never)
			)
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
		expect(
			await refusalOf(() => holderService.createHolder({ providerKey: PROVIDER, status: 'ACTIVE' } as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
		expect(
			await refusalOf(() =>
				holderService.createHolder({ providerKey: PROVIDER, mandateReference: 'mandate-1' } as never)
			)
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
	});

	it('refuses a creation with no provider key, because the row could not be addressed afterwards', async () => {
		const { holderService } = instruments();

		expect(await refusalOf(() => holderService.createHolder({ providerKey: '  ' }))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
	});
});

describe('PaymentAccountHolderService — the status machine (schema chapter §3.19)', () => {
	it('moves PENDING to ACTIVE, REJECTED or DISABLED, and nowhere else', async () => {
		const { holderService } = instruments({
			holders: [
				holderRow(HOLDER),
				holderRow(OTHER_HOLDER, { contactId: OTHER_CONTACT }),
				holderRow('holder-3', { contactId: 'contact-3' })
			]
		});

		// PENDING → RESTRICTED is not an edge of the graph: a provider does not restrict an account it
		// has never accepted.
		expect(await refusalOf(() => holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.RESTRICTED))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);

		await holderService.recordProviderAccount(HOLDER, EXTERNAL);

		expect((await holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.ACTIVE)).status).toBe(
			PaymentAccountHolderStatus.ACTIVE
		);

		// A second account of another party may be rejected straight from pending: a rejected application
		// never reached the provider, so it keeps the null reference it was created with.
		expect(
			(await holderService.transitionStatus(OTHER_HOLDER, PaymentAccountHolderStatus.REJECTED)).status
		).toBe(PaymentAccountHolderStatus.REJECTED);

		expect((await holderService.transitionStatus('holder-3', PaymentAccountHolderStatus.DISABLED)).status).toBe(
			PaymentAccountHolderStatus.DISABLED
		);
	});

	it('moves ACTIVE to RESTRICTED and back, and never back to PENDING', async () => {
		const { holderService } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.ACTIVE, externalAccountId: EXTERNAL })]
		});

		expect((await holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.RESTRICTED)).status).toBe(
			PaymentAccountHolderStatus.RESTRICTED
		);
		expect((await holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.ACTIVE)).status).toBe(
			PaymentAccountHolderStatus.ACTIVE
		);
		expect(await refusalOf(() => holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.PENDING))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
	});

	it('treats REJECTED and DISABLED as terminal', async () => {
		const { holderService } = instruments({
			holders: [
				holderRow(HOLDER, { status: PaymentAccountHolderStatus.REJECTED }),
				holderRow(OTHER_HOLDER, { status: PaymentAccountHolderStatus.DISABLED, externalAccountId: EXTERNAL })
			]
		});

		for (const next of [
			PaymentAccountHolderStatus.ACTIVE,
			PaymentAccountHolderStatus.RESTRICTED,
			PaymentAccountHolderStatus.DISABLED
		]) {
			expect(await refusalOf(() => holderService.transitionStatus(HOLDER, next))).toMatch(
				/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
			);
		}

		expect(
			await refusalOf(() => holderService.transitionStatus(OTHER_HOLDER, PaymentAccountHolderStatus.ACTIVE))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
	});

	it('refuses a status no account can hold', async () => {
		const { holderService } = instruments({ holders: [holderRow(HOLDER)] });

		expect(await refusalOf(() => holderService.transitionStatus(HOLDER, 'ONBOARDING' as never))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
	});

	it('refuses a move to ACTIVE while the account still names no provider reference', async () => {
		const { holderService } = instruments({ holders: [holderRow(HOLDER)] });

		// The invariant is "the external account id is null exactly while the account is PENDING": an
		// account that may be charged has to name the account it is charged against.
		expect(await refusalOf(() => holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.ACTIVE))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
	});

	it('refuses a second live account of the same party, provider and kind', async () => {
		const { holderService, holder } = instruments({
			holders: [
				holderRow(HOLDER, { status: PaymentAccountHolderStatus.ACTIVE, externalAccountId: EXTERNAL }),
				// The same party and the same provider, in another role: a buyer account beside a payout
				// account is a legitimate configuration, which is why the kind is in the rule's tuple.
				holderRow(OTHER_HOLDER, { type: PaymentAccountHolderType.SELLER }),
				holderRow('holder-3')
			]
		});

		await holderService.recordProviderAccount(OTHER_HOLDER, 'acct-provider-2');
		await holderService.recordProviderAccount('holder-3', 'acct-provider-3');

		expect(
			(await holderService.transitionStatus(OTHER_HOLDER, PaymentAccountHolderStatus.ACTIVE)).status
		).toBe(PaymentAccountHolderStatus.ACTIVE);

		// The buyer account of the same party and provider is the one the rule forbids.
		expect(
			await refusalOf(() => holderService.transitionStatus('holder-3', PaymentAccountHolderStatus.ACTIVE))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS/);
		expect(holder('holder-3')?.status).toBe(PaymentAccountHolderStatus.PENDING);
	});
});

describe('PaymentAccountHolderService — the external account id and the mandate', () => {
	it('records the provider reference once, and refuses a rewrite', async () => {
		const { holderService, holder } = instruments({ holders: [holderRow(HOLDER)] });

		await holderService.recordProviderAccount(HOLDER, ` ${EXTERNAL} `);

		expect(holder()?.externalAccountId).toBe(EXTERNAL);

		// The same reference again is a provider acknowledging twice, and changes nothing.
		await holderService.recordProviderAccount(HOLDER, EXTERNAL);
		expect(holder()?.externalAccountId).toBe(EXTERNAL);

		// A different one is refused: an account whose provider reference can be rewritten is an account
		// whose charges can be redirected.
		expect(await refusalOf(() => holderService.recordProviderAccount(HOLDER, 'acct-provider-9'))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
		expect(holder()?.externalAccountId).toBe(EXTERNAL);
	});

	it('refuses a provider reference already held by an account of the same provider', async () => {
		const { holderService } = instruments({
			holders: [
				holderRow(HOLDER, { externalAccountId: EXTERNAL, status: PaymentAccountHolderStatus.ACTIVE }),
				holderRow(OTHER_HOLDER, { contactId: OTHER_CONTACT })
			]
		});

		expect(await refusalOf(() => holderService.recordProviderAccount(OTHER_HOLDER, EXTERNAL))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_ACTIVE_EXISTS/
		);
	});

	it('writes the mandate as one fact in two halves, and clears both together', async () => {
		const { holderService, holder } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.ACTIVE, externalAccountId: EXTERNAL })]
		});

		expect(
			await refusalOf(() => holderService.setMandate(HOLDER, { mandateReference: 'mandate-1' } as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID/);
		expect(
			await refusalOf(() => holderService.setMandate(HOLDER, { mandateAcceptedAt: new Date() } as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_MANDATE_INVALID/);
		expect(holder()?.mandateReference).toBeUndefined();

		await holderService.setMandate(HOLDER, {
			mandateReference: ' mandate-1 ',
			mandateAcceptedAt: new Date('2026-03-01T10:00:00.000Z')
		});

		expect(holder()?.mandateReference).toBe('mandate-1');
		expect(holderService.hasMandate(holder() as never)).toBe(true);

		await holderService.clearMandate(HOLDER);
		expect(holder()?.mandateReference).toBeNull();
		expect(holder()?.mandateAcceptedAt).toBeNull();
		expect(holderService.hasMandate(holder() as never)).toBe(false);
	});

	it('refuses a mandate on an account nothing may be charged against', async () => {
		const { holderService } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.DISABLED })]
		});

		expect(
			await refusalOf(() =>
				holderService.setMandate(HOLDER, {
					mandateReference: 'mandate-1',
					mandateAcceptedAt: new Date()
				})
			)
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
	});
});

describe('PaymentAccountHolderService — closing an account revokes its instruments (rule 5)', () => {
	it('revokes every instrument in the same transaction, keeping the rows', async () => {
		const { holderService, token, statements } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.ACTIVE, externalAccountId: EXTERNAL })],
			tokens: [
				tokenRow('token-1', { isDefault: true }),
				tokenRow('token-2', { status: 'REVOKED', revokedAt: new Date('2026-01-01T00:00:00.000Z') })
			]
		});

		await holderService.disableHolder(HOLDER);

		expect(token('token-1')?.status).toBe('REVOKED');
		expect(token('token-1')?.revokedAt).toBeInstanceOf(Date);
		expect(token('token-1')?.isDefault).toBe(false);

		// A row that was already revoked keeps the instant it was revoked at — the record of why the
		// instrument went away is not overwritten by the account closing afterwards.
		expect(token('token-2')?.revokedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));

		// The revocation ran through the account's own transaction, not a second one opened beside it.
		expect(statements.some((one) => one.lockedRead === 'payment_account_holder')).toBe(true);
	});

	it('is idempotent, unlike a status move', async () => {
		const { holderService } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.DISABLED })]
		});

		expect((await holderService.disableHolder(HOLDER)).status).toBe(PaymentAccountHolderStatus.DISABLED);
		expect(await refusalOf(() => holderService.transitionStatus(HOLDER, PaymentAccountHolderStatus.ACTIVE))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
	});

	it('refuses to soft-delete an account that is still live, and allows it once disabled', async () => {
		const { holderService, holder } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.ACTIVE, externalAccountId: EXTERNAL })]
		});

		expect(await refusalOf(() => holderService.softRemoveHolder(HOLDER))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_IN_USE/
		);
		expect(holder()?.deletedAt).toBeUndefined();

		await holderService.disableHolder(HOLDER);
		await holderService.softRemoveHolder(HOLDER);

		expect(holder()?.deletedAt).toBeInstanceOf(Date);
		expect(holder()?.status).toBe(PaymentAccountHolderStatus.DISABLED);
	});
});

describe('PaymentAccountHolderService — the descriptive update and the charge guard', () => {
	it('refuses a descriptive update that carries a lifecycle member', async () => {
		const { holderService } = instruments({ holders: [holderRow(HOLDER)] });

		expect(
			await refusalOf(() => holderService.updateHolder(HOLDER, { status: 'ACTIVE' } as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
		expect(
			await refusalOf(() => holderService.updateHolder(HOLDER, { externalAccountId: EXTERNAL } as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/);
	});

	it('applies the descriptive facts it does own', async () => {
		const { holderService, holder } = instruments({ holders: [holderRow(HOLDER)] });

		await holderService.updateHolder(HOLDER, {
			country: 'DE',
			defaultCurrency: 'eur',
			verificationStatus: PaymentAccountVerificationStatus.VERIFIED
		});

		expect(holder()?.country).toBe('DE');
		expect(holder()?.defaultCurrency).toBe('eur');
		expect(holder()?.verificationStatus).toBe(PaymentAccountVerificationStatus.VERIFIED);
	});

	it('refuses to edit a terminal account', async () => {
		const { holderService } = instruments({
			holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.REJECTED })]
		});

		expect(await refusalOf(() => holderService.updateHolder(HOLDER, { country: 'FR' }))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_STATUS_INVALID/
		);
	});

	it('refuses every status but ACTIVE at the charge guard', async () => {
		const { holderService } = instruments();

		expect(() =>
			holderService.assertChargeable({ status: PaymentAccountHolderStatus.ACTIVE } as never)
		).not.toThrow();

		for (const status of [
			PaymentAccountHolderStatus.PENDING,
			PaymentAccountHolderStatus.RESTRICTED,
			PaymentAccountHolderStatus.REJECTED,
			PaymentAccountHolderStatus.DISABLED
		]) {
			expect(() => holderService.assertChargeable({ status } as never)).toThrow(
				/^PAYMENT_ACCOUNT_HOLDER_RESTRICTED/
			);
		}
	});

	it('scopes every read to the caller, so an account of another organization is not found', async () => {
		const { holderService } = instruments({
			holders: [holderRow(HOLDER, { organizationId: 'another-organization' })]
		});

		expect(await holderService.findHolder(HOLDER)).toBeNull();
		expect(await refusalOf(() => holderService.findHolderOrFail(HOLDER))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_NOT_FOUND/
		);
	});
});
