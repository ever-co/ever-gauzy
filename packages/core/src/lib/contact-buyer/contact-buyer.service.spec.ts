/**
 * The company-account membership — who may buy for an organization contact, in what role, and up to what
 * (schema chapter §7.4, company accounts in the customers document §6.1).
 *
 * Five rules, and the suite walks each of them: the account must be a company and live, a party is never
 * its own buyer and a pair holds one membership, a buyer belongs to at most one live company account —
 * decided under a lock on the account row — the limits narrow and never widen, and the effective
 * authorisation is the role plus the ceilings, answered as a value the caller can read.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The service under test is the real one, over two in-memory tables and a transaction manager,
 * and the suite runs as Postgres so the row lock is the statement a production deployment issues rather
 * than the embedded dialect's no-op.
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
	// The suite runs as Postgres so the row lock the membership write takes is the statement a production
	// deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ContactBuyerRole } from '@gauzy/contracts';
import { ContactStatus, PartyKind } from '../core/enums/kernel-extension.enums';
import { OrganizationContact } from '../core/entities/internal';
import { ContactBuyer } from './contact-buyer.entity';
import { ContactBuyerService } from './contact-buyer.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const COMPANY = 'contact-company';
const OTHER_COMPANY = 'contact-company-2';
const BUYER = 'contact-buyer';
const OTHER_BUYER = 'contact-buyer-2';

type Row = Record<string, any>;

/** The entity classes the service hands to its transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[ContactBuyer, 'contact_buyer'],
	[OrganizationContact, 'organization_contact']
]);

/**
 * An in-memory stand-in for the two tables and the transaction manager they are written through.
 *
 * The `where` the service states is applied, so a read that stopped narrowing is caught here, and the
 * lock the service takes is recorded rather than modelled: `pessimistic_write` is stated once and the
 * suite asserts it was stated, which is the platform's own reading of what a lock is worth testing.
 */
function world(seed: { companies?: Row[]; buyers?: Row[] } = {}) {
	const tables: Record<string, Row[]> = {
		contact_buyer: [...(seed.buyers ?? [])],
		organization_contact: [...(seed.companies ?? [])]
	};
	const locks: string[] = [];
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

		const created = { id: `${table}-${++sequence}`, isActive: true, createdAt: new Date(), ...row };

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
				setLock: (mode: string) => {
					locks.push(`${tableOf(entity)}:${mode}`);

					return builder;
				},
				getOne: async () =>
					tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null
			};

			return builder;
		}
	};

	const repository = {
		manager,
		metadata: { tableName: 'contact_buyer', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables.contact_buyer.filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables.contact_buyer.find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables.contact_buyer.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save('contact_buyer', row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables.contact_buyer.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables.contact_buyer[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};

	return {
		tables,
		locks,
		service: new ContactBuyerService(repository as never, {} as never),
		membership: (id: string) => tables.contact_buyer.find((row) => row.id === id)
	};
}

/** One `organization_contact` row that is a live company account. */
const companyRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Company ${id}`,
	partyKind: PartyKind.COMPANY,
	status: ContactStatus.ACTIVE,
	isActive: true,
	...overrides
});

/** One `contact_buyer` row. */
const membershipRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	companyCustomerId: COMPANY,
	buyerCustomerId: BUYER,
	role: ContactBuyerRole.PURCHASER,
	isActive: true,
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

describe('ContactBuyerService — the account a buyer joins', () => {
	it('attaches a buyer to a company account, defaulting the role and timestamping the membership', async () => {
		const { service, membership, locks } = world({ companies: [companyRow(COMPANY)] });

		const created = await service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER });

		expect(created.role).toBe(ContactBuyerRole.PURCHASER);
		expect(created.companyCustomerId).toBe(COMPANY);
		expect(created.buyerCustomerId).toBe(BUYER);
		expect(created.assignedAt).toBeInstanceOf(Date);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(membership(created.id)).toBeDefined();
		// The account row is held for the decision, so two concurrent invitations serialize.
		expect(locks).toContain('organization_contact:pessimistic_write');
	});

	it('stores the terms the caller states', async () => {
		const { service } = world({ companies: [companyRow(COMPANY)] });

		const created = await service.addBuyer({
			companyCustomerId: COMPANY,
			buyerCustomerId: BUYER,
			role: ContactBuyerRole.APPROVER,
			spendingLimit: 5000,
			periodSpendingLimit: 20000,
			approvalThreshold: 2500,
			periodStartDay: 15,
			invitedByUserId: 'user-1'
		});

		expect(created.role).toBe(ContactBuyerRole.APPROVER);
		expect(created.spendingLimit).toBe(5000);
		expect(created.periodSpendingLimit).toBe(20000);
		expect(created.approvalThreshold).toBe(2500);
		expect(created.periodStartDay).toBe(15);
		expect(created.invitedByUserId).toBe('user-1');
	});

	it('refuses a party named as a company account that is not one', async () => {
		const { service, tables } = world({
			companies: [companyRow(COMPANY, { partyKind: PartyKind.INDIVIDUAL })]
		});

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER }))
		).toContain('COMPANY_ACCOUNT_REQUIRED');
		expect(tables.contact_buyer).toHaveLength(0);
	});

	it('refuses a company account that is blocked, which is the refusal checkout gets too', async () => {
		const { service } = world({ companies: [companyRow(COMPANY, { status: ContactStatus.BLOCKED })] });

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER }))
		).toContain('CONTACT_BLOCKED');
	});

	it('refuses a company account that does not exist in the caller scope', async () => {
		const { service } = world();

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER }))
		).toContain('CONTACT_NOT_FOUND');
	});

	it('refuses an account that names itself as its own buyer', async () => {
		const { service, tables } = world({ companies: [companyRow(COMPANY)] });

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: COMPANY }))
		).toContain('CONTACT_BUYER_SELF');
		expect(tables.contact_buyer).toHaveLength(0);
	});

	it('refuses a second live membership for the same pair', async () => {
		const { service, tables } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1')]
		});

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER }))
		).toContain('CONTACT_BUYER_EXISTS');
		expect(tables.contact_buyer).toHaveLength(1);
	});

	it('refuses a buyer who already belongs to another live company account', async () => {
		const { service, tables } = world({
			companies: [companyRow(COMPANY), companyRow(OTHER_COMPANY)],
			buyers: [membershipRow('membership-1', { companyCustomerId: OTHER_COMPANY })]
		});

		expect(
			await refusalOf(() => service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER }))
		).toContain('CONTACT_BUYER_COMPANY_EXISTS');
		expect(tables.contact_buyer).toHaveLength(1);
	});

	it('allows a buyer whose only other membership is no longer active', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY), companyRow(OTHER_COMPANY)],
			buyers: [membershipRow('membership-1', { companyCustomerId: OTHER_COMPANY, isActive: false })]
		});

		const created = await service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER });

		expect(created.companyCustomerId).toBe(COMPANY);
	});
});

describe('ContactBuyerService — the terms a membership may hold', () => {
	it('refuses a negative ceiling', async () => {
		const { service } = world({ companies: [companyRow(COMPANY)] });

		for (const member of ['spendingLimit', 'periodSpendingLimit', 'approvalThreshold']) {
			expect(
				await refusalOf(() =>
					service.addBuyer({
						companyCustomerId: COMPANY,
						buyerCustomerId: BUYER,
						[member]: -1
					} as never)
				)
			).toContain('CONTACT_BUYER_TERMS_INVALID');
		}
	});

	it('refuses a period start day outside 1–28, which is the range every month has', async () => {
		const { service } = world({ companies: [companyRow(COMPANY)] });

		for (const day of [0, 29, 31, 2.5]) {
			expect(
				await refusalOf(() =>
					service.addBuyer({ companyCustomerId: COMPANY, buyerCustomerId: BUYER, periodStartDay: day })
				)
			).toContain('CONTACT_BUYER_TERMS_INVALID');
		}
	});

	it('refuses a role that is not one a buyer may hold', async () => {
		const { service } = world({ companies: [companyRow(COMPANY)] });

		expect(
			await refusalOf(() =>
				service.addBuyer({
					companyCustomerId: COMPANY,
					buyerCustomerId: BUYER,
					role: 'OWNER' as never
				})
			)
		).toContain('CONTACT_BUYER_TERMS_INVALID');
	});

	it('changes the terms of a membership and never its two sides', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY), companyRow(OTHER_COMPANY)],
			buyers: [membershipRow('membership-1', { role: ContactBuyerRole.VIEWER })]
		});

		const updated = await service.updateBuyer('membership-1', {
			role: ContactBuyerRole.PURCHASER,
			spendingLimit: 1000,
			companyCustomerId: OTHER_COMPANY
		} as never);

		expect(updated.role).toBe(ContactBuyerRole.PURCHASER);
		expect(updated.spendingLimit).toBe(1000);
		// The pair is what the membership *is*: re-pointing it is refused by omission rather than applied.
		expect(updated.companyCustomerId).toBe(COMPANY);
	});

	it('soft-deletes a membership, which is the only removal path there is', async () => {
		const { service, membership } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1')]
		});

		await service.removeBuyer('membership-1');

		expect(membership('membership-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('answers a miss with CONTACT_BUYER_NOT_FOUND rather than an empty row', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.findBuyerOrFail('missing'))).toContain('CONTACT_BUYER_NOT_FOUND');
	});
});

describe('ContactBuyerService — what a buyer may do', () => {
	it('resolves the live company account a buyer belongs to, and ignores a membership that is not active', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1')]
		});

		expect((await service.resolveCompanyAccountOf(BUYER))?.companyCustomerId).toBe(COMPANY);
		expect(await service.resolveCompanyAccountOf(OTHER_BUYER)).toBeNull();

		const archived = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1', { isArchived: true })]
		});

		expect(await archived.service.resolveCompanyAccountOf(BUYER)).toBeNull();
	});

	it('reads the role as three separate authorities rather than one flag', async () => {
		const { service } = world();

		expect(service.resolveAuthority(membershipRow('m', { role: ContactBuyerRole.VIEWER }) as never)).toMatchObject({
			mayPurchase: false,
			mayApprove: false,
			mayAdminister: false
		});
		expect(
			service.resolveAuthority(membershipRow('m', { role: ContactBuyerRole.PURCHASER }) as never)
		).toMatchObject({ mayPurchase: true, mayApprove: false, mayAdminister: false });
		expect(service.resolveAuthority(membershipRow('m', { role: ContactBuyerRole.APPROVER }) as never)).toMatchObject({
			mayPurchase: true,
			mayApprove: true,
			mayAdminister: false
		});
		expect(service.resolveAuthority(membershipRow('m', { role: ContactBuyerRole.ADMIN }) as never)).toMatchObject({
			mayPurchase: true,
			mayApprove: true,
			mayAdminister: true
		});
	});

	it('refuses a party that buys for no account', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.assertMayPurchase(BUYER, 100))).toContain('CONTACT_BUYER_NOT_FOUND');
	});

	it('refuses a viewer an order, which the role may not place at any amount', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1', { role: ContactBuyerRole.VIEWER })]
		});

		expect(await refusalOf(() => service.assertMayPurchase(BUYER, 10))).toContain('BUYER_NOT_AUTHORISED');
	});

	it('refuses an order above the per-order ceiling and names the ceiling', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1', { spendingLimit: 500 })]
		});

		const withinLimit = await service.assertMayPurchase(BUYER, 500);
		expect(withinLimit.spendingLimit).toBe(500);

		expect(await refusalOf(() => service.assertMayPurchase(BUYER, 500.01))).toContain('BUYER_LIMIT_EXCEEDED');
	});

	it('refuses an order that would take the rolling period past its ceiling', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1', { periodSpendingLimit: 1000 })]
		});

		await expect(service.assertMayPurchase(BUYER, 400, 600)).resolves.toBeDefined();
		expect(await refusalOf(() => service.assertMayPurchase(BUYER, 400, 600.01))).toContain(
			'BUYER_LIMIT_EXCEEDED'
		);
	});

	it('answers a role-only check without evaluating a ceiling', async () => {
		const { service } = world({
			companies: [companyRow(COMPANY)],
			buyers: [membershipRow('membership-1', { spendingLimit: 1 })]
		});

		const membership = await service.assertMayPurchase(BUYER);

		expect(membership.role).toBe(ContactBuyerRole.PURCHASER);
	});

	it('reads membership state from the inherited columns, with no second active flag', async () => {
		const { service } = world();

		expect(service.isBuyerActive(membershipRow('m') as never)).toBe(true);
		expect(service.isBuyerActive(membershipRow('m', { isActive: false }) as never)).toBe(false);
		expect(service.isBuyerActive(membershipRow('m', { deletedAt: new Date() }) as never)).toBe(false);
	});
});
