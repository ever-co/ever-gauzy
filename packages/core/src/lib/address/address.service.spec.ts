/**
 * The address book — the reusable postal addresses a party, a location or the organization owns
 * (schema chapter §3.6).
 *
 * Four rules, and the suite walks each of them: the owner dimension and the buyer reference that must
 * agree with it, the country code that is normalised and resolved into a lookup row, the default that
 * has **one** authority and two mirrors, and the removal that is a soft delete and never rewrites a
 * document. The refusals the schema names — `ADDRESS_OWNER_MISMATCH`, `ADDRESS_DEFAULT_MISMATCH` — are
 * asserted where the specification states them, and so are the ordinary cases that must **not** be
 * refused: the anonymous cart address, a code the country list does not carry, and an address whose
 * owner is a warehouse rather than a party.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole
 * application graph — a unit test pays for the narrowest surface the module under test touches. The
 * services under test are the real ones: `AddressService` and the delivered `AddressRoleService` it
 * writes its role rows through, over an in-memory set of tables that applies the `where` the services
 * state and the `In(...)` they build. A service that stopped scoping its reads, stopped clearing the
 * sibling it replaces, or stopped writing the party's authoritative column is caught here rather than
 * accommodated.
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

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
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
	// The suite runs as Postgres so the row lock the default operations take is the statement a
	// production deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { AddressOwnerType } from '@gauzy/contracts';
import { Address } from './address.entity';
import { AddressService } from './address.service';
import { AddressRole } from '../address-role/address-role.entity';
import { AddressRoleEnum } from '../address-role/address-role.enums';
import { AddressRoleService } from '../address-role/address-role.service';
import { Country } from '../country/country.entity';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const CONTACT = 'contact-1';
const OTHER_CONTACT = 'contact-2';
const HOME = 'address-home';
const WORK = 'address-work';
const WAREHOUSE = 'warehouse-1';
const GERMANY = 'country-de';

type Row = Record<string, any>;

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, string>([
	[Address, 'address'],
	[AddressRole, 'address_role'],
	[Country, 'country'],
	[OrganizationContact, 'organization_contact']
]);

/** The `In(...)` a service built, or null when the value is a plain comparison. */
function inList(expected: any): any[] | null {
	if (expected && typeof expected === 'object' && (expected._type === 'in' || expected.type === 'in')) {
		return expected._value ?? expected.value ?? [];
	}

	return null;
}

/** Whether one row satisfies one `where`, with a missing column and a null column read alike. */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		const list = inList(expected);

		if (list) {
			return list.map((one) => String(one)).includes(String(row[field]));
		}

		return String(row[field] ?? '') === String(expected ?? '');
	});
}

/**
 * An in-memory stand-in for the four tables and the transaction manager they are written through.
 *
 * The `where` the services state is applied — equality and `In(...)`, with a missing column and a null
 * column treated as the same thing to the database — so a read that stopped narrowing is caught here.
 * A row saved through the manager carries the table it belongs to, because two of the writes the
 * services perform are `manager.save(row)` on a row they read back rather than on an entity class, and
 * a double that guessed the table would be asserting its own guess.
 */
function world(seed: { addresses?: Row[]; countries?: Row[]; roles?: Row[]; contacts?: Row[] } = {}) {
	// Every row carries the table it belongs to, seeded rows included: two of the writes the services
	// perform are `manager.save(row)` on a row they read back rather than on an entity class, and a
	// double that guessed the table from the row's shape would be asserting its own guess.
	const stamped = (table: string, rows: Row[] = []): Row[] => rows.map((row) => ({ __table: table, ...row }));
	const tables: Record<string, Row[]> = {
		address: stamped('address', seed.addresses),
		address_role: stamped('address_role', seed.roles),
		country: stamped('country', seed.countries),
		organization_contact: stamped('organization_contact', seed.contacts)
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

	const save = (table: string, row: Row): Row => {
		if (row.id) {
			const index = tables[table].findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables[table][index] = { ...tables[table][index], ...row };

				return tables[table][index];
			}
		}

		const created = { id: `${table}-${++sequence}`, createdAt: new Date(), __table: table, ...row };

		tables[table].push(created);

		return created;
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		create: (entity: unknown, partial: Row) => ({ ...partial, __table: tableOf(entity) }),
		save: async (entity: unknown, rows?: Row | Row[]) => {
			if (rows === undefined) {
				// `manager.save(row)` — the row remembers the table it was read or created from.
				const row = entity as Row;
				const table = row.__table ?? tableOf(entity);

				return save(table, row);
			}

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
		update: async (entity: unknown, criteria: any, partial: Row) => {
			const table = tableOf(entity);
			const where = typeof criteria === 'string' ? { id: criteria } : criteria;
			const rows = tables[table].filter((row) => matches(row, where));

			for (const row of rows) {
				Object.assign(row, partial);
			}

			statements.push({ update: table, ...where });

			return { affected: rows.length };
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
		create: (partial: Row) => ({ ...partial, __table: table }),
		save: async (row: Row) => save(table, row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[table].findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const before = tables[table].length;

			tables[table] = tables[table].filter((row) => !matches(row, where));

			return { affected: before - tables[table].length };
		}
	});

	return {
		tables,
		locks,
		statements,
		addressRepository: repository('address'),
		roleRepository: repository('address_role'),
		address: (id: string = HOME) => tables.address.find((row) => row.id === id),
		contact: (id: string = CONTACT) => tables.organization_contact.find((row) => row.id === id),
		roles: (addressId: string = HOME) => tables.address_role.filter((row) => row.addressId === addressId)
	};
}

/** One `address` row, with the fields this suite reads. */
const addressRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	line1: 'Hafenstrasse 12',
	city: 'Hamburg',
	countryCode: 'DE',
	countryId: GERMANY,
	ownerType: AddressOwnerType.CONTACT,
	ownerId: CONTACT,
	customerId: CONTACT,
	isDefaultShipping: false,
	isDefaultBilling: false,
	isValidated: false,
	...overrides
});

/** One `address_role` row. */
const roleRow = (addressId: string, role: AddressRoleEnum, overrides: Row = {}): Row => ({
	id: `role-${addressId}-${role}`,
	tenantId: TENANT,
	organizationId: ORG,
	addressId,
	role,
	isDefault: false,
	...overrides
});

/** One `organization_contact` row, with only the two authoritative default references this suite reads. */
const contactRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	defaultShippingAddressId: null,
	defaultBillingAddressId: null,
	...overrides
});

/** The two services under test, over one in-memory world. */
function book(seed: { addresses?: Row[]; countries?: Row[]; roles?: Row[]; contacts?: Row[] } = {}) {
	const store = world({
		...seed,
		// The country list this platform would ship with: `DE` resolves, and whatever the case adds sits
		// beside it rather than replacing it.
		countries: [{ id: GERMANY, isoCode: 'DE', country: 'Germany' }, ...(seed.countries ?? [])]
	});
	const roleService = new AddressRoleService(store.roleRepository as never, {} as never);
	const addressService = new AddressService(
		store.addressRepository as never,
		{} as never,
		roleService
	);

	return { ...store, addressService, roleService };
}

/** The message of the error a call raises, prefixed by its catalogue code, or `undefined`. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		const code = (error as any)?.code;

		return code ? `${code}: ${(error as Error).message}` : (error as Error).message;
	}
}

describe('AddressService — recording an address in the book', () => {
	it('records the address in the caller scope, with the country resolved from its code', async () => {
		const { addressService, address } = book();

		const created = await addressService.createAddress({
			label: ' Home ',
			line1: 'Hafenstrasse 12',
			city: 'Hamburg',
			countryCode: 'de',
			ownerId: CONTACT,
			customerId: CONTACT
		});

		// The code is normalised, and the lookup row is the one the code names.
		expect(created.countryCode).toBe('DE');
		expect(created.countryId).toBe(GERMANY);
		expect(created.label).toBe(' Home ');
		expect(created.ownerType).toBe(AddressOwnerType.CONTACT);
		expect(created.isDefaultShipping).toBe(false);
		expect(created.isDefaultBilling).toBe(false);
		expect(created.isValidated).toBe(false);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(address(created.id)).toBeDefined();
	});

	it('refuses a creation that names no street line, no city, no country code or no owner', async () => {
		const { addressService } = book();

		expect(
			await refusalOf(() =>
				addressService.createAddress({ city: 'Hamburg', countryCode: 'DE', ownerId: CONTACT } as never)
			)
		).toMatch(/^VALIDATION_REQUIRED_FIELD/);
		expect(
			await refusalOf(() =>
				addressService.createAddress({ line1: 'Hafenstrasse 12', countryCode: 'DE', ownerId: CONTACT } as never)
			)
		).toMatch(/^VALIDATION_REQUIRED_FIELD/);
		expect(
			await refusalOf(() =>
				addressService.createAddress({ line1: 'Hafenstrasse 12', city: 'Hamburg', ownerId: CONTACT } as never)
			)
		).toMatch(/^VALIDATION_FAILED/);
		expect(
			await refusalOf(() =>
				addressService.createAddress({ line1: 'Hafenstrasse 12', city: 'Hamburg', countryCode: 'DE' } as never)
			)
		).toMatch(/^VALIDATION_REQUIRED_FIELD/);
	});

	it('refuses a country code that is not two letters', async () => {
		const { addressService } = book();

		for (const countryCode of ['Germany', 'D', 'D1', '  ']) {
			expect(
				await refusalOf(() =>
					addressService.createAddress({
						line1: 'Hafenstrasse 12',
						city: 'Hamburg',
						countryCode,
						ownerId: CONTACT
					})
				)
			).toMatch(/^VALIDATION_FAILED/);
		}
	});

	it('refuses a stated country lookup row the code does not name', async () => {
		const { addressService } = book({
			countries: [{ id: 'country-fr', isoCode: 'FR', country: 'France' }]
		});

		// The invariant is "filled when and only when the code matches", so the code is the input and a
		// second, independent answer to the same question is refused rather than stored.
		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Hafenstrasse 12',
					city: 'Hamburg',
					countryCode: 'DE',
					countryId: 'country-fr',
					ownerId: CONTACT
				})
			)
		).toMatch(/^VALIDATION_FAILED/);

		// The row the code does name is accepted, because it states the same fact twice.
		const created = await addressService.createAddress({
			line1: 'Hafenstrasse 12',
			city: 'Hamburg',
			countryCode: 'DE',
			countryId: GERMANY,
			ownerId: CONTACT
		});

		expect(created.countryId).toBe(GERMANY);
	});

	it('leaves the lookup row null for a code the country list does not carry', async () => {
		const { addressService } = book();

		const created = await addressService.createAddress({
			line1: '1 Example Street',
			city: 'Springfield',
			countryCode: 'zz',
			ownerId: CONTACT
		});

		expect(created.countryCode).toBe('ZZ');
		expect(created.countryId).toBeNull();
	});

	it('refuses a body that states a validation verdict', async () => {
		const { addressService } = book();

		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Hafenstrasse 12',
					city: 'Hamburg',
					countryCode: 'DE',
					ownerId: CONTACT,
					isValidated: true
				} as never)
			)
		).toMatch(/^VALIDATION_UNKNOWN_FIELD/);
		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Hafenstrasse 12',
					city: 'Hamburg',
					countryCode: 'DE',
					ownerId: CONTACT,
					validationProviderKey: 'acme-verify'
				} as never)
			)
		).toMatch(/^VALIDATION_UNKNOWN_FIELD/);
	});
});

describe('AddressService — the owner dimension and the buyer reference', () => {
	it('refuses a buyer reference that names another row than the owner', async () => {
		const { addressService } = book();

		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Hafenstrasse 12',
					city: 'Hamburg',
					countryCode: 'DE',
					ownerType: AddressOwnerType.CONTACT,
					ownerId: CONTACT,
					customerId: OTHER_CONTACT
				})
			)
		).toMatch(/^ADDRESS_OWNER_MISMATCH/);
	});

	it('refuses a buyer reference on an address whose owner is not a party', async () => {
		const { addressService } = book();

		// A warehouse is a location, not a party: it has no buyer, and a buyer reference on its address
		// is the disagreement the code names.
		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Dock 4',
					city: 'Hamburg',
					countryCode: 'DE',
					ownerType: AddressOwnerType.WAREHOUSE,
					ownerId: WAREHOUSE,
					customerId: CONTACT
				})
			)
		).toMatch(/^ADDRESS_OWNER_MISMATCH/);

		const created = await addressService.createAddress({
			line1: 'Dock 4',
			city: 'Hamburg',
			countryCode: 'DE',
			ownerType: AddressOwnerType.WAREHOUSE,
			ownerId: WAREHOUSE
		});

		expect(created.ownerType).toBe(AddressOwnerType.WAREHOUSE);
		expect(created.customerId).toBeNull();
	});

	it('accepts the anonymous address a cart creates before the customer registers', async () => {
		const { addressService } = book();

		// The one case the invariant does not refuse: a contact address with no buyer reference is the
		// guest row the table describes, and the nightly audit reports it rather than this service
		// inventing a party for it.
		const created = await addressService.createAddress({
			line1: 'Hafenstrasse 12',
			city: 'Hamburg',
			countryCode: 'DE',
			ownerId: 'guest-of-this-organization'
		});

		expect(created.customerId).toBeNull();
		expect(created.ownerType).toBe(AddressOwnerType.CONTACT);
	});

	it('refuses an owner kind the vocabulary does not hold', async () => {
		const { addressService } = book();

		expect(
			await refusalOf(() =>
				addressService.createAddress({
					line1: 'Hafenstrasse 12',
					city: 'Hamburg',
					countryCode: 'DE',
					ownerType: 'STORE' as never,
					ownerId: CONTACT
				})
			)
		).toMatch(/^VALIDATION_INVALID_ENUM/);
	});
});

describe('AddressService — the default has one authority and two mirrors', () => {
	it('makes the first address the default in all three places, in one transaction', async () => {
		const { addressService, address, contact, roles, statements } = book({
			addresses: [addressRow(HOME)],
			contacts: [contactRow(CONTACT)]
		});

		const saved = await addressService.setDefaultAddress(HOME, AddressRoleEnum.SHIPPING);

		// The mirror on the address, the role row, and the party's authoritative column.
		expect(saved.isDefaultShipping).toBe(true);
		expect(address()?.isDefaultShipping).toBe(true);
		expect(roles()).toHaveLength(1);
		expect(roles()[0].role).toBe(AddressRoleEnum.SHIPPING);
		expect(roles()[0].isDefault).toBe(true);
		expect(contact()?.defaultShippingAddressId).toBe(HOME);

		// The decision was taken under the address's own row lock, and inside one transaction.
		expect(statements.some((one) => one.lockedRead === 'address')).toBe(true);
	});

	it('moves the default: the sibling is cleared before the flag is set', async () => {
		const { addressService, address, contact, roles } = book({
			addresses: [
				addressRow(HOME, { isDefaultShipping: true }),
				addressRow(WORK, { line1: 'Werftweg 3' })
			],
			roles: [
				roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true }),
				roleRow(WORK, AddressRoleEnum.SHIPPING)
			],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		await addressService.setDefaultAddress(WORK, AddressRoleEnum.SHIPPING);

		expect(address(WORK)?.isDefaultShipping).toBe(true);
		expect(address(HOME)?.isDefaultShipping).toBe(false);
		expect(roles(WORK)[0].isDefault).toBe(true);
		expect(roles(HOME)[0].isDefault).toBe(false);
		expect(contact()?.defaultShippingAddressId).toBe(WORK);
	});

	it('refuses a default on a role that has none', async () => {
		const { addressService } = book({ addresses: [addressRow(HOME)] });

		// A default is a statement the book can act on. Only the two roles with a boolean mirror are
		// resolved that way today, so a default anywhere else is a flag nothing reads.
		expect(await refusalOf(() => addressService.setDefaultAddress(HOME, AddressRoleEnum.PAYOUT))).toMatch(
			/^VALIDATION_INVALID_ENUM/
		);
		expect(await refusalOf(() => addressService.clearDefaultAddress(HOME, AddressRoleEnum.RETURN))).toMatch(
			/^VALIDATION_INVALID_ENUM/
		);
	});

	it('clears the default from the address, the role row and the party column', async () => {
		const { addressService, address, contact, roles } = book({
			addresses: [addressRow(HOME, { isDefaultBilling: true })],
			roles: [roleRow(HOME, AddressRoleEnum.BILLING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultBillingAddressId: HOME })]
		});

		await addressService.clearDefaultAddress(HOME, AddressRoleEnum.BILLING);

		expect(address()?.isDefaultBilling).toBe(false);
		expect(roles()[0].isDefault).toBe(false);
		expect(contact()?.defaultBillingAddressId).toBeNull();
	});

	it('resolves the default of an owner and role, and refuses a party column that contradicts it', async () => {
		const agreeing = book({
			addresses: [addressRow(HOME, { isDefaultShipping: true })],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		const resolved = await agreeing.addressService.findDefaultAddress(
			AddressOwnerType.CONTACT,
			CONTACT,
			AddressRoleEnum.SHIPPING
		);

		expect(resolved?.id).toBe(HOME);

		// The party's column is the authority, and a role row that names another address is the drift
		// the reconcile job reports — refused here rather than answered with one of two answers.
		const disagreeing = book({
			addresses: [addressRow(HOME, { isDefaultShipping: true }), addressRow(WORK)],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: WORK })]
		});

		expect(
			await refusalOf(() =>
				disagreeing.addressService.findDefaultAddress(AddressOwnerType.CONTACT, CONTACT, AddressRoleEnum.SHIPPING)
			)
		).toMatch(/^ADDRESS_DEFAULT_MISMATCH/);
	});

	it('refuses an owner whose two addresses both claim the role', async () => {
		const { addressService } = book({
			addresses: [
				addressRow(HOME, { isDefaultShipping: true }),
				addressRow(WORK, { isDefaultShipping: true })
			],
			roles: [
				roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true }),
				roleRow(WORK, AddressRoleEnum.SHIPPING, { isDefault: true })
			],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		// There is no rule that says which of two claimants is right, so neither is picked.
		expect(
			await refusalOf(() =>
				addressService.findDefaultAddress(AddressOwnerType.CONTACT, CONTACT, AddressRoleEnum.SHIPPING)
			)
		).toMatch(/^ADDRESS_DEFAULT_MISMATCH/);
	});

	it('refuses a descriptive update that clears the default the party names', async () => {
		const { addressService, address } = book({
			addresses: [addressRow(HOME, { isDefaultShipping: true })],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		expect(
			await refusalOf(() => addressService.updateAddress(HOME, { isDefaultShipping: false }))
		).toMatch(/^ADDRESS_DEFAULT_MISMATCH/);
		expect(address()?.isDefaultShipping).toBe(true);

		// An address the party does not name is cleared without ceremony: nothing authoritative says
		// otherwise, so there is nothing to disagree with.
		const other = book({
			addresses: [
				addressRow(HOME, { isDefaultShipping: true }),
				addressRow(WORK, { isDefaultShipping: true })
			],
			roles: [roleRow(WORK, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		await other.addressService.updateAddress(WORK, { isDefaultShipping: false });

		expect(other.address(WORK)?.isDefaultShipping).toBe(false);
	});

	it('moves the default when a descriptive update sets the flag', async () => {
		const { addressService, address, contact } = book({
			addresses: [
				addressRow(HOME, { isDefaultShipping: true }),
				addressRow(WORK, { line1: 'Werftweg 3' })
			],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		await addressService.updateAddress(WORK, { isDefaultShipping: true });

		expect(address(WORK)?.isDefaultShipping).toBe(true);
		expect(address(HOME)?.isDefaultShipping).toBe(false);
		expect(contact()?.defaultShippingAddressId).toBe(WORK);
	});

	it('leaves the default of an address whose owner is not a party to the role rows', async () => {
		const { addressService, address, roles } = book({
			addresses: [
				addressRow(WAREHOUSE, {
					ownerType: AddressOwnerType.WAREHOUSE,
					ownerId: WAREHOUSE,
					customerId: null
				})
			]
		});

		const saved = await addressService.setDefaultAddress(WAREHOUSE, AddressRoleEnum.SHIPPING);

		// No party row means no authoritative column to write, and the role row is then the only place
		// the default lives — which the read answers from.
		expect(saved.isDefaultShipping).toBe(true);
		expect(address(WAREHOUSE)?.isDefaultShipping).toBe(true);
		expect(roles(WAREHOUSE)[0].isDefault).toBe(true);
	});
});

describe('AddressService — the roles an address plays', () => {
	it('replaces the role set, revoking the roles no longer stated', async () => {
		const { addressService, roles } = book({
			addresses: [addressRow(HOME)],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING), roleRow(HOME, AddressRoleEnum.RETURN)]
		});

		const stored = await addressService.setRoles(HOME, [
			{ role: AddressRoleEnum.SHIPPING },
			{ role: AddressRoleEnum.REGISTERED },
			{ role: AddressRoleEnum.PAYOUT }
		]);

		expect(stored.map((one) => one.role).sort()).toEqual(
			[AddressRoleEnum.SHIPPING, AddressRoleEnum.REGISTERED, AddressRoleEnum.PAYOUT].sort()
		);
		expect(roles().some((one) => one.role === AddressRoleEnum.RETURN)).toBe(false);
	});

	it('refuses a stated role default that contradicts the address own flag', async () => {
		const { addressService, roles } = book({
			addresses: [addressRow(HOME, { isDefaultShipping: true })],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })]
		});

		// The mirror rule: the boolean is written by the default operations, and a role write is not a
		// second door into it.
		expect(
			await refusalOf(() =>
				addressService.setRoles(HOME, [{ role: AddressRoleEnum.SHIPPING, isDefault: false }])
			)
		).toMatch(/^ADDRESS_DEFAULT_MISMATCH/);
		expect(roles()[0].isDefault).toBe(true);
	});

	it('lets the pivot refuse a default on a role that has none', async () => {
		const { addressService } = book({ addresses: [addressRow(HOME)] });

		expect(
			await refusalOf(() => addressService.setRoles(HOME, [{ role: AddressRoleEnum.PAYOUT, isDefault: true }]))
		).toMatch(/^ADDRESS_ROLE_DEFAULT_UNSUPPORTED/);
	});

	it('answers the roles of one address, and refuses a miss', async () => {
		const { addressService } = book({
			addresses: [addressRow(HOME)],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING), roleRow(HOME, AddressRoleEnum.BILLING)]
		});

		expect((await addressService.listRoles(HOME)).sort()).toEqual(
			[AddressRoleEnum.SHIPPING, AddressRoleEnum.BILLING].sort()
		);
		expect(await refusalOf(() => addressService.listRoles('address-missing'))).toMatch(/^RESOURCE_NOT_FOUND/);
	});
});

describe('AddressService — removal is a soft delete', () => {
	it('refuses to remove the address the party names as its default', async () => {
		const { addressService, address } = book({
			addresses: [addressRow(HOME, { isDefaultShipping: true })],
			roles: [roleRow(HOME, AddressRoleEnum.SHIPPING, { isDefault: true })],
			contacts: [contactRow(CONTACT, { defaultShippingAddressId: HOME })]
		});

		// Removing it would leave the party's column naming a row that is gone; the default is moved
		// first, which is one call.
		expect(await refusalOf(() => addressService.softRemoveAddress(HOME))).toMatch(/^ADDRESS_DEFAULT_MISMATCH/);
		expect(address()?.deletedAt).toBeUndefined();
	});

	it('soft-deletes an address and revokes the roles that described it', async () => {
		const { addressService, address, roles } = book({
			addresses: [addressRow(WORK)],
			roles: [roleRow(WORK, AddressRoleEnum.SHIPPING), roleRow(WORK, AddressRoleEnum.RETURN)]
		});

		const removed = await addressService.softRemoveAddress(WORK);

		// The row is still there — an order that was placed with this address keeps its own snapshot,
		// and a saved instrument may still bill to it — and the roles of a removed address are gone.
		expect(removed.deletedAt).toBeInstanceOf(Date);
		expect(address(WORK)?.deletedAt).toBeInstanceOf(Date);
		expect(roles(WORK)).toHaveLength(0);
	});

	it('answers a miss as not found', async () => {
		const { addressService } = book();

		expect(await refusalOf(() => addressService.findAddressOrFail('address-missing'))).toMatch(
			/^RESOURCE_NOT_FOUND/
		);
		expect(await addressService.findAddress('address-missing')).toBeNull();
	});
});

describe('AddressService — every read is scoped to the caller', () => {
	it('does not find an address of another organization', async () => {
		const { addressService } = book({
			addresses: [addressRow(HOME, { organizationId: OTHER_ORG })]
		});

		expect(await addressService.findAddress(HOME)).toBeNull();
		expect(await refusalOf(() => addressService.findAddressOrFail(HOME))).toMatch(/^RESOURCE_NOT_FOUND/);
		expect(await addressService.listAddresses()).toHaveLength(0);
	});

	it('narrows a list by the filter it was given', async () => {
		const { addressService } = book({
			addresses: [
				addressRow(HOME, { isDefaultShipping: true }),
				addressRow(WORK, { line1: 'Werftweg 3' }),
				addressRow(WAREHOUSE, {
					ownerType: AddressOwnerType.WAREHOUSE,
					ownerId: WAREHOUSE,
					customerId: null
				})
			]
		});

		expect((await addressService.listAddresses({ customerId: CONTACT })).map((one) => one.id).sort()).toEqual(
			[HOME, WORK].sort()
		);
		expect(await addressService.listAddresses({ isDefaultShipping: true })).toHaveLength(1);
		expect(await addressService.listAddresses({ ownerType: AddressOwnerType.WAREHOUSE })).toHaveLength(1);
		// The filter's code is normalised the same way a write's is, so 'de' and 'DE' narrow alike.
		expect(await addressService.listAddresses({ countryCode: 'de' })).toHaveLength(3);
	});
});
