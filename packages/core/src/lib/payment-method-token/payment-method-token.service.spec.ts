/**
 * The saved instrument — the provider reference the platform may charge again (schema chapter §3.20).
 *
 * Six rules, and the suite walks each of them: a row exists only because the provider issued and
 * confirmed its reference, one instrument is one row, at most one default per account and instrument
 * kind under a row lock on the account, only an `ACTIVE` instrument is chargeable, revocation is
 * idempotent and keeps the row, and every attempt that reached the provider is stamped.
 *
 * The base CRUD class is doubled — it reaches the entity barrel and with it the whole application
 * graph — while the service under test is the real one over an in-memory table that applies the `where`
 * the service states.
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
	// The suite runs as Postgres so the row lock the default rule takes is the statement a production
	// deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { PaymentAccountHolderStatus, PaymentMethodTokenStatus, PaymentMethodTokenType } from '@gauzy/contracts';
import { PaymentAccountHolder } from '../payment-account-holder/payment-account-holder.entity';
import { PaymentMethodToken } from './payment-method-token.entity';
import { PaymentMethodTokenService } from './payment-method-token.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const HOLDER = 'holder-1';
const OTHER_HOLDER = 'holder-2';
const PROVIDER = 'acme-pay';
const EXTERNAL = 'acct-provider-1';

type Row = Record<string, any>;

/** The entity classes the service hands to its transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[PaymentAccountHolder, 'payment_account_holder'],
	[PaymentMethodToken, 'payment_method_token']
]);

/**
 * An in-memory stand-in for the two tables and the transaction manager they are written through.
 *
 * The `where` the service states is applied, so a read that stopped narrowing — by tenancy, by account,
 * by status — is caught here rather than accommodated. `order` is not modelled: no case in this suite
 * depends on the order of a list.
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
		locks,
		statements,
		holderRepository: repository('payment_account_holder'),
		tokenRepository: repository('payment_method_token'),
		token: (id: string) => tables.payment_method_token.find((row) => row.id === id),
		tokens: () => tables.payment_method_token
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

/** The service under test, over one in-memory world. */
function instruments(seed: { holders?: Row[]; tokens?: Row[] } = {}) {
	const store = world({ holders: seed.holders ?? [holderRow(HOLDER), holderRow(OTHER_HOLDER)], tokens: seed.tokens });
	const service = new PaymentMethodTokenService(
		store.tokenRepository as never,
		{} as never,
		store.holderRepository as never
	);

	return { ...store, service };
}

/** A creation that passes every rule, so a case can vary exactly one thing. */
const creation = (overrides: Row = {}): Row => ({
	accountHolderId: HOLDER,
	providerKey: PROVIDER,
	token: 'tok-issued',
	providerConfirmation: { token: 'tok-issued', confirmedAt: new Date('2026-03-01T10:00:00.000Z') },
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('PaymentMethodTokenService — a row exists only because the provider issued its reference', () => {
	it('records the instrument the provider confirmed, with the account it belongs to', async () => {
		const { service, token } = instruments();

		const recorded = await service.recordProviderInstrument(creation() as never);

		expect(recorded.token).toBe('tok-issued');
		expect(recorded.status).toBe(PaymentMethodTokenStatus.ACTIVE);
		expect(recorded.isDefault).toBe(false);
		// The provider registration is the account's, never the caller's to state.
		expect(recorded.paymentProviderId).toBe('provider-registration-1');
		expect(recorded.tenantId).toBe(TENANT);
		expect((recorded.metadata as Row)?.providerConfirmedAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
		expect(token(recorded.id)).toBeDefined();
	});

	it('refuses a reference the provider did not return, and one that was never confirmed', async () => {
		const { service, tokens } = instruments();

		expect(await refusalOf(() => service.recordProviderInstrument(creation({ providerConfirmation: undefined }) as never))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
		expect(
			await refusalOf(() =>
				service.recordProviderInstrument(
					creation({ providerConfirmation: { token: 'tok-something-else', confirmedAt: new Date() } }) as never
				)
			)
		).toMatch(/^PAYMENT_METHOD_VALIDATION_FAILED/);
		expect(await refusalOf(() => service.recordProviderInstrument(creation({ token: '   ' }) as never))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
		expect(tokens()).toHaveLength(0);
	});

	it('refuses an instrument claimed against another provider than its account belongs to', async () => {
		const { service } = instruments();

		expect(await refusalOf(() => service.recordProviderInstrument(creation({ providerKey: 'other-pay' }) as never))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
	});

	it('refuses a missing account, and one that is closed', async () => {
		const { service } = instruments({ holders: [holderRow(HOLDER, { status: PaymentAccountHolderStatus.DISABLED })] });

		expect(
			await refusalOf(() => service.recordProviderInstrument(creation({ accountHolderId: 'nobody' }) as never))
		).toMatch(/^PAYMENT_ACCOUNT_HOLDER_NOT_FOUND/);
		expect(await refusalOf(() => service.recordProviderInstrument(creation() as never))).toMatch(
			/^PAYMENT_ACCOUNT_HOLDER_RESTRICTED/
		);
	});
});

describe('PaymentMethodTokenService — one instrument is one row', () => {
	it('refuses a provider reference that is already saved and still reusable', async () => {
		const { service } = instruments({
			tokens: [tokenRow('token-1', { token: 'tok-issued' })]
		});

		expect(await refusalOf(() => service.recordProviderInstrument(creation() as never))).toMatch(
			/^PAYMENT_METHOD_TOKEN_ALREADY_SAVED/
		);
	});

	it('allows the same reference again once the earlier row is revoked', async () => {
		const { service, tokens } = instruments({
			tokens: [tokenRow('token-1', { token: 'tok-issued', status: PaymentMethodTokenStatus.REVOKED })]
		});

		const recorded = await service.recordProviderInstrument(creation() as never);

		expect(tokens()).toHaveLength(2);
		expect(recorded.status).toBe(PaymentMethodTokenStatus.ACTIVE);
	});
});

describe('PaymentMethodTokenService — an instrument carries only the facts its kind has', () => {
	it('refuses a card expiry on a bank account or a recurring debit', async () => {
		const { service, tokens } = instruments();

		expect(
			await refusalOf(() =>
				service.recordProviderInstrument(
					creation({ type: PaymentMethodTokenType.BANK_ACCOUNT, expiryMonth: 4, expiryYear: 2030 }) as never
				)
			)
		).toMatch(/^PAYMENT_METHOD_VALIDATION_FAILED/);
		expect(
			await refusalOf(() =>
				service.recordProviderInstrument(
					creation({ type: PaymentMethodTokenType.DIRECT_DEBIT, expiryMonth: 4, expiryYear: 2030 }) as never
				)
			)
		).toMatch(/^PAYMENT_METHOD_VALIDATION_FAILED/);

		// Control: the same expiry on a card is what a card has.
		await service.recordProviderInstrument(creation({ expiryMonth: 4, expiryYear: 2030 }) as never);
		expect(tokens()).toHaveLength(1);
	});

	it('refuses half an expiry, which names no instant', async () => {
		const { service } = instruments();

		expect(
			await refusalOf(() => service.recordProviderInstrument(creation({ expiryMonth: 4 }) as never))
		).toMatch(/^PAYMENT_METHOD_VALIDATION_FAILED/);
		expect(
			await refusalOf(() => service.recordProviderInstrument(creation({ expiryYear: 2030 }) as never))
		).toMatch(/^PAYMENT_METHOD_VALIDATION_FAILED/);
	});

	it('refuses a change that would give a non-expiring instrument an expiry', async () => {
		const { service } = instruments({
			tokens: [tokenRow('token-1', { type: PaymentMethodTokenType.BANK_ACCOUNT })]
		});

		expect(await refusalOf(() => service.updateToken('token-1', { expiryMonth: 4, expiryYear: 2030 }))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
	});

	it('applies the descriptive facts it owns, keeping the provider confirmation beside them', async () => {
		const { service } = instruments({
			tokens: [
				tokenRow('token-1', {
					metadata: { providerConfirmedAt: new Date('2026-03-01T10:00:00.000Z') }
				})
			]
		});

		const updated = await service.updateToken('token-1', { holderName: 'A Party', metadata: { issuer: 'acme' } });

		expect(updated.holderName).toBe('A Party');
		expect((updated.metadata as Row)?.issuer).toBe('acme');
		// The confirmation is the record of where the reference came from and survives a later edit.
		expect((updated.metadata as Row)?.providerConfirmedAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
	});
});

describe('PaymentMethodTokenService — at most one default per account and instrument kind', () => {
	it('clears the previous default in the same transaction, under a row lock on the account', async () => {
		const { service, token, locks, statements } = instruments({
			tokens: [
				tokenRow('token-1', { isDefault: true }),
				tokenRow('token-2', { token: 'tok-2' }),
				// Another kind's default is untouched: one default card beside one default bank account is a
				// legitimate configuration.
				tokenRow('token-3', { token: 'tok-3', type: PaymentMethodTokenType.BANK_ACCOUNT, isDefault: true })
			]
		});

		await service.setDefaultToken('token-2');

		expect(token('token-2')?.isDefault).toBe(true);
		expect(token('token-1')?.isDefault).toBe(false);
		expect(token('token-3')?.isDefault).toBe(true);
		expect(locks).toEqual(['payment_account_holder:pessimistic_write']);
		// The decision is taken inside the transaction that writes it, on the account row the rule is
		// about, not read outside and written around.
		expect(statements.some((one) => one.lockedRead === 'payment_account_holder')).toBe(true);
	});

	it('refuses a default on an instrument that is not ACTIVE, naming the state it found', async () => {
		const { service } = instruments({
			tokens: [
				tokenRow('revoked', { status: PaymentMethodTokenStatus.REVOKED }),
				tokenRow('expired', { status: PaymentMethodTokenStatus.EXPIRED }),
				tokenRow('failed', { status: PaymentMethodTokenStatus.FAILED })
			]
		});

		expect(await refusalOf(() => service.setDefaultToken('revoked'))).toMatch(
			/^PAYMENT_METHOD_TOKEN_REVOKED/
		);
		expect(await refusalOf(() => service.setDefaultToken('expired'))).toMatch(
			/^PAYMENT_METHOD_TOKEN_EXPIRED/
		);
		expect(await refusalOf(() => service.setDefaultToken('failed'))).toMatch(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
	});

	it('applies the default when a creation asks for one', async () => {
		const { service, token } = instruments({ tokens: [tokenRow('token-1', { isDefault: true })] });

		const recorded = await service.recordProviderInstrument(creation({ isDefault: true }) as never);

		expect(recorded.isDefault).toBe(true);
		expect(token('token-1')?.isDefault).toBe(false);
	});

	it('clears a default without naming a replacement', async () => {
		const { service, token } = instruments({ tokens: [tokenRow('token-1', { isDefault: true })] });

		await service.clearDefaultToken('token-1');

		expect(token('token-1')?.isDefault).toBe(false);
	});

	it('reads the account defaults so a caller can tell none from more than one', async () => {
		const { service } = instruments({
			tokens: [
				tokenRow('token-1', { isDefault: true }),
				tokenRow('token-2', { token: 'tok-2', type: PaymentMethodTokenType.BANK_ACCOUNT, isDefault: true })
			]
		});

		expect(await service.findDefaultTokens(HOLDER)).toHaveLength(2);
		expect(await service.findDefaultTokens(HOLDER, PaymentMethodTokenType.CARD)).toHaveLength(1);
		expect(await service.findDefaultToken(OTHER_HOLDER)).toBeNull();
	});
});

describe('PaymentMethodTokenService — revocation is the only removal path', () => {
	it('revokes, keeps the row, stamps the instant and clears the default', async () => {
		const { service, token, tokens } = instruments({
			tokens: [tokenRow('token-1', { isDefault: true })]
		});

		const revoked = await service.revokeToken('token-1');

		expect(revoked.status).toBe(PaymentMethodTokenStatus.REVOKED);
		expect(revoked.revokedAt).toBeInstanceOf(Date);
		expect(revoked.isDefault).toBe(false);
		expect(tokens()).toHaveLength(1);
		expect(token('token-1')?.token).toBe('tok-token-1');
	});

	it('is idempotent, and stamps no second instant', async () => {
		const instant = new Date('2026-02-01T00:00:00.000Z');
		const { service, token } = instruments({
			tokens: [tokenRow('token-1', { status: PaymentMethodTokenStatus.REVOKED, revokedAt: instant })]
		});

		const again = await service.revokeToken('token-1');

		expect(again.revokedAt).toEqual(instant);
		expect(token('token-1')?.revokedAt).toEqual(instant);
	});

	it('refuses to edit a removed instrument, because re-adding one writes a new row', async () => {
		const { service } = instruments({
			tokens: [tokenRow('token-1', { status: PaymentMethodTokenStatus.REVOKED })]
		});

		expect(await refusalOf(() => service.updateToken('token-1', { holderName: 'A Party' }))).toMatch(
			/^PAYMENT_METHOD_TOKEN_REVOKED/
		);
	});
});

describe('PaymentMethodTokenService — only an ACTIVE instrument is chargeable', () => {
	it('passes an active instrument and refuses the rest with the code that names the state', async () => {
		const { service } = instruments();

		expect(() => service.assertChargeable({ status: PaymentMethodTokenStatus.ACTIVE } as never)).not.toThrow();
		expect(() => service.assertChargeable({ status: PaymentMethodTokenStatus.REVOKED } as never)).toThrow(
			/^PAYMENT_METHOD_TOKEN_REVOKED/
		);
		expect(() => service.assertChargeable({ status: PaymentMethodTokenStatus.EXPIRED } as never)).toThrow(
			/^PAYMENT_METHOD_TOKEN_EXPIRED/
		);
		expect(() => service.assertChargeable({ status: PaymentMethodTokenStatus.FAILED } as never)).toThrow(
			/^PAYMENT_METHOD_VALIDATION_FAILED/
		);
	});

	it('expires an instrument and clears its default, without overwriting a removal', async () => {
		const { service, token } = instruments({
			tokens: [
				tokenRow('token-1', { isDefault: true }),
				tokenRow('token-2', { status: PaymentMethodTokenStatus.REVOKED, revokedAt: new Date('2026-01-01') })
			]
		});

		await service.expireToken('token-1');

		expect(token('token-1')?.status).toBe(PaymentMethodTokenStatus.EXPIRED);
		expect(token('token-1')?.isDefault).toBe(false);

		await service.expireToken('token-2');

		// Removal is a decision somebody made; expiring it afterwards would lose the only record of why.
		expect(token('token-2')?.status).toBe(PaymentMethodTokenStatus.REVOKED);
	});
});

describe('PaymentMethodTokenService — every attempt that reached the provider is stamped', () => {
	it('stamps the use and clears the decline bookkeeping on a successful attempt', async () => {
		const { service, token } = instruments({
			tokens: [
				tokenRow('token-1', {
					status: PaymentMethodTokenStatus.FAILED,
					metadata: { consecutiveDeclines: 3, lastDeclineCode: 'do_not_honour' }
				})
			]
		});

		const recorded = await service.recordProviderAttempt('token-1', { succeeded: true });

		expect(recorded.lastUsedAt).toBeInstanceOf(Date);
		// A successful charge is the one way back from the refused state: the provider accepted it, so the
		// earlier refusal no longer describes it.
		expect(recorded.status).toBe(PaymentMethodTokenStatus.ACTIVE);
		expect((recorded.metadata as Row)?.consecutiveDeclines).toBe(0);
		expect(token('token-1')?.lastUsedAt).toBeInstanceOf(Date);
	});

	it('counts a refusal, records why, and refuses the instrument when the refusal is terminal', async () => {
		const { service, token } = instruments({ tokens: [tokenRow('token-1')] });

		const declined = await service.recordProviderAttempt('token-1', {
			succeeded: false,
			declineCode: 'insufficient_funds'
		});

		expect(declined.status).toBe(PaymentMethodTokenStatus.ACTIVE);
		expect(declined.lastUsedAt).toBeInstanceOf(Date);
		expect((declined.metadata as Row)?.consecutiveDeclines).toBe(1);
		expect((declined.metadata as Row)?.lastDeclineCode).toBe('insufficient_funds');

		const terminal = await service.recordProviderAttempt('token-1', {
			succeeded: false,
			declineCode: 'stolen_card',
			terminal: true
		});

		expect(terminal.status).toBe(PaymentMethodTokenStatus.FAILED);
		expect(terminal.isDefault).toBe(false);
		expect(token('token-1')?.status).toBe(PaymentMethodTokenStatus.FAILED);
	});
});

describe('PaymentMethodTokenService — tenancy', () => {
	it('does not find an instrument of another organization', async () => {
		const { service } = instruments({
			tokens: [tokenRow('token-1', { organizationId: 'another-organization' })]
		});

		expect(await service.findToken('token-1')).toBeNull();
		expect(await refusalOf(() => service.findTokenOrFail('token-1'))).toMatch(
			/^PAYMENT_METHOD_TOKEN_NOT_FOUND/
		);
	});
});
