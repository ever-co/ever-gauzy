/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a provider registry needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the service under test is
 * the real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors the platform's `CrudService` where the behaviour is observable to a
 * caller, and that is both halves of the read pair. `findOneByWhereOptions` is documented as answering
 * `null` ("Finds first entity that matches given where condition. If entity was not found in the
 * database - returns null") but it does not: on both the TypeORM and the MikroORM branch it raises
 * `NotFoundException` when the row is absent (`crud.service.ts`, `findOneByWhereOptions`). That is the
 * base class this service actually runs on, so the double states the throw rather than the prose.
 * `findOneOrFailByWhereOptions` is the half a caller uses when absence is an ordinary answer: it
 * answers an `ITryRequest` carrying `success: false` instead of raising, which is what the two
 * registry reads below are written against.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			// Faithful to the platform: an absent row is a refusal, not a null.
			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneOrFailByWhereOptions(where: any): Promise<any> {
			// Faithful to the platform: the same read, reporting the miss as a value rather than raising.
			const record = await this.typeOrmRepository.findOneBy(where);

			return record ? { success: true, record } : { success: false };
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
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { PaymentProviderService } from './payment-provider.service';

/**
 * The provider registry.
 *
 * Every read and every write of this service is scoped to the caller's tenant and organization, and
 * the rules it owns are the ones the table alone cannot express (doc 10 §8.1, doc 05 §12.1):
 *
 * - **the code is unique inside the organization and is the key the adapter is resolved from.** A
 *   second registration of the same code is refused, and the code of a stored registration can never
 *   be re-pointed, because that would silently move every session that references the row onto a
 *   different adapter;
 * - **credentials never live in the row.** `configuration` and `metadata` carry non-secret settings
 *   only — the wrapped credentials belong to the integration the row points at — so a document that
 *   names a credential is refused on write, recursively and case-insensitively;
 * - **a disabled registration is refused loudly at the moment a session would use it**, with
 *   `PAYMENT_PROVIDER_DISABLED`, rather than dropped from the offer in silence;
 * - **a code is resolved inside one organization**, which is what decides whose credentials a public
 *   callback is verified with.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states — equality, the set-membership operator, the `null` column — and the
 * `order` the payment step asks for, because a double that returned every row regardless would make
 * the scoping and the ordering cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	payment_provider: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				// The TypeORM spelling of a set-membership test.
				if (expected.type === 'in') {
					return (expected.value as unknown[]).some((one) => String(row[field] ?? '') === String(one));
				}

				throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}

			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const ordered = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (String(left[column] ?? '') > String(right[column] ?? '') ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => ordered(rows().filter((row) => matches(row, options.where)), options.order),
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `payment_provider` row, as the service reads it. */
const providerRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: id,
	name: `Provider ${id}`,
	isEnabled: true,
	isTestMode: false,
	sortOrder: 0,
	...overrides
});

/**
 * Builds the provider service over one in-memory `payment_provider` table.
 *
 * @param rows The registrations the fixture starts with.
 */
function providerFixture(rows: Row[] = []) {
	const tables: ITables = { payment_provider: [...rows] };
	const service = new PaymentProviderService(repository(tables, 'payment_provider') as never, {} as never);

	return { service, tables, store: (id: string) => tables.payment_provider.find((row) => row.id === id) };
}

describe('PaymentProviderService — what a registration may not be (doc 10 §8.1, doc 05 §12.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a registration with no code, and one whose code is only whitespace', async () => {
		const fixture = providerFixture();

		await expect(fixture.service.createProvider({ name: 'Nameless' } as never)).rejects.toThrow(
			/PAYMENT_PROVIDER_CODE_REQUIRED/
		);
		await expect(fixture.service.createProvider({ code: '   ', name: 'Blank' } as never)).rejects.toThrow(
			/PAYMENT_PROVIDER_CODE_REQUIRED/
		);
		expect(fixture.tables.payment_provider).toEqual([]);
	});

	it('refuses a registration with no name, and one whose name is only whitespace', async () => {
		const fixture = providerFixture();

		await expect(fixture.service.createProvider({ code: 'card-primary' } as never)).rejects.toThrow(
			/PAYMENT_PROVIDER_NAME_REQUIRED/
		);
		await expect(
			fixture.service.createProvider({ code: 'card-primary', name: '  ' } as never)
		).rejects.toThrow(/PAYMENT_PROVIDER_NAME_REQUIRED/);
		expect(fixture.tables.payment_provider).toEqual([]);
	});

	it('refuses a code another registration of the same organization already holds', async () => {
		// The code is the key the adapter is resolved from, so a second row claiming it would make
		// "which adapter does this session use?" a question with two answers (doc 10 §8.1).
		const fixture = providerFixture([providerRow('card-primary')]);

		await expect(
			fixture.service.createProvider({ code: 'card-primary', name: 'Another card' } as never)
		).rejects.toThrow(/already registered in this organization/);
		expect(fixture.tables.payment_provider).toHaveLength(1);
	});

	it.each([
		['a camel-cased api key', { apiKey: 'sk_live_1' }, 'configuration.apiKey'],
		['a snake-cased signing secret', { signing_secret: 'whsec_1' }, 'configuration.signing_secret'],
		['a credential nested under a public name', { payment: { api_key: 'sk_live_2' } }, 'configuration.payment.api_key'],
		['a credential inside a list', { methods: [{ token: 'tok_1' }] }, 'configuration.methods[0].token'],
		['a client secret', { webhook: { clientSecret: 'cs_1' } }, 'configuration.webhook.clientSecret']
	])('refuses %s in the configuration, naming the member', async (_label, configuration, member) => {
		// A secret in a provider row is a second, unmanaged copy of a credential the integration registry
		// already holds wrapped and rotated, so the write is refused rather than stored (doc 10 §8.1,
		// "Credential handling"). The walk is recursive and case-insensitive, so `apiKey`, `api_key` and
		// `payment.apiKey` are one name.
		const fixture = providerFixture();
		const quoted = String(member).replace(/[.[\]]/g, '\\$&');

		await expect(
			fixture.service.createProvider({ code: 'card-primary', name: 'Card', configuration } as never)
		).rejects.toThrow(new RegExp(`PAYMENT_PROVIDER_SECRET_NOT_ALLOWED: '${quoted}'`));
		expect(fixture.tables.payment_provider).toEqual([]);
	});

	it('refuses a credential carried in the metadata document as well', async () => {
		const fixture = providerFixture();

		await expect(
			fixture.service.createProvider({
				code: 'card-primary',
				name: 'Card',
				metadata: { webhookToleranceSeconds: 300, password: 'hunter2' }
			} as never)
		).rejects.toThrow(/PAYMENT_PROVIDER_SECRET_NOT_ALLOWED: 'metadata.password'/);
		expect(fixture.tables.payment_provider).toEqual([]);
	});
});

describe('PaymentProviderService — the code is the adapter key (doc 10 §8.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an update that would re-point the code at another adapter', async () => {
		const fixture = providerFixture([providerRow('card-primary')]);

		await expect(fixture.service.updateProvider('card-primary', { code: 'card-secondary' } as never)).rejects.toThrow(
			/cannot change/
		);
		expect(fixture.store('card-primary').code).toBe('card-primary');
	});

	it('accepts an update that re-states the code it already has', async () => {
		// Control: the guard compares the stated code with the stored one, so a form that posts the whole
		// registration back is not a code change.
		const fixture = providerFixture([providerRow('card-primary')]);

		const updated = await fixture.service.updateProvider('card-primary', {
			code: ' card-primary ',
			name: 'Card (renamed)'
		} as never);

		expect(updated).toMatchObject({ code: 'card-primary', name: 'Card (renamed)' });
	});

	it('disables a provider through an ordinary update and keeps its other fields', async () => {
		// Withdrawing a provider is an edit of `isEnabled`, not a delete: the sessions already on record
		// keep resolving, and only the offer changes (doc 10 §8.1).
		const fixture = providerFixture([
			providerRow('card-primary', { configuration: { captureMode: 'MANUAL' }, sortOrder: 3 })
		]);

		const updated = await fixture.service.updateProvider('card-primary', { isEnabled: false } as never);

		expect(updated).toMatchObject({
			isEnabled: false,
			sortOrder: 3,
			configuration: { captureMode: 'MANUAL' }
		});
	});

	it('stores the non-secret document the adapter actually reads', async () => {
		// Control for the refusals above: public identifiers, capture flags, a webhook path and the event
		// map are exactly what `configuration` is for, and none of them is a credential.
		const fixture = providerFixture([providerRow('card-primary')]);

		const updated = await fixture.service.updateProvider('card-primary', {
			configuration: {
				publicKey: 'pk_live_1',
				webhookPath: '/webhooks/card-primary',
				captureMode: 'MANUAL',
				eventMap: { 'payment_intent.succeeded': 'capture-payment' }
			},
			metadata: { supportsPartialCapture: true, webhookToleranceSeconds: 300 }
		} as never);

		expect(updated.configuration).toMatchObject({ publicKey: 'pk_live_1', captureMode: 'MANUAL' });
		expect(updated.metadata).toMatchObject({ supportsPartialCapture: true });
	});

	it('refuses a credential introduced by an update, and writes nothing of it', async () => {
		const fixture = providerFixture([providerRow('card-primary')]);

		await expect(
			fixture.service.updateProvider('card-primary', { configuration: { apiSecret: 'sk_1' } } as never)
		).rejects.toThrow(/PAYMENT_PROVIDER_SECRET_NOT_ALLOWED: 'configuration.apiSecret'/);
		expect(fixture.store('card-primary').configuration).toBeUndefined();
	});

	it('reports an unknown registration as missing and never touches another organization’s row', async () => {
		const fixture = providerFixture([providerRow('theirs', { organizationId: OTHER_ORG })]);

		await expect(fixture.service.updateProvider('nope', { name: 'X' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.updateProvider('theirs', { name: 'X' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(fixture.store('theirs').name).toBe('Provider theirs');
	});
});

describe('PaymentProviderService — what is offered, and what is refused at the till (doc 10 §8.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a disabled provider with the documented code and accepts an enabled one', () => {
		const fixture = providerFixture();

		expect(() => fixture.service.assertEnabled(providerRow('off', { isEnabled: false }))).toThrow(
			/PAYMENT_PROVIDER_DISABLED/
		);
		expect(() => fixture.service.assertEnabled(providerRow('on', { isEnabled: true }))).not.toThrow();
	});

	it('offers only the enabled registrations, in the order the payment step shows them', async () => {
		const fixture = providerFixture([
			providerRow('third', { sortOrder: 30 }),
			providerRow('withdrawn', { sortOrder: 5, isEnabled: false }),
			providerRow('first', { sortOrder: 10 }),
			providerRow('theirs', { sortOrder: 1, organizationId: OTHER_ORG })
		]);

		const offered = await fixture.service.findEnabledProviders();

		expect(offered.map((provider) => provider.id)).toEqual(['first', 'third']);
	});

	it('resolves a callback’s provider code inside the caller’s organization and nowhere else', async () => {
		// A provider code arrives on a public callback path, so the lookup is what decides which
		// organization's credentials a signature is verified with. A code registered by another
		// organization is not this caller's provider (doc 10 §8.9 step 1).
		const fixture = providerFixture([
			providerRow('mine', { code: 'card-primary' }),
			providerRow('theirs', { code: 'card-primary', organizationId: OTHER_ORG, isTestMode: true })
		]);

		expect((await fixture.service.findProviderByCode('card-primary')).id).toBe('mine');

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		expect((await fixture.service.findProviderByCode('card-primary')).id).toBe('theirs');
	});

	it('paginates the registrations of the caller’s organization, and only those', async () => {
		const fixture = providerFixture([
			providerRow('mine'),
			providerRow('also-mine'),
			providerRow('theirs', { organizationId: OTHER_ORG })
		]);

		const page = await fixture.service.findProviders();

		expect(page.total).toBe(2);
		expect(page.items.map((provider) => provider.id).sort()).toEqual(['also-mine', 'mine']);
	});
});

/**
 * The registry's two fail-soft reads and the refusal they replaced.
 *
 * `createProvider` asks "is this code free?" through `findProviderByCode`, and
 * `PaymentWebhookEventService.resolveProvider` branches on `findProviderOrNull` being `null` to raise
 * `PAYMENT_WEBHOOK_UNKNOWN_PROVIDER`. Both are reads whose documented answer for an absent row is
 * `null`, and both go through `findOneOrFailByWhereOptions`, whose `ITryRequest` carries
 * `success: false` rather than raising — which is why a free code registers and an unknown identifier
 * is an answer the caller can branch on.
 */
describe('PaymentProviderService — registration and the null read (doc 10 §8.1, doc 10 §8.9)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('registers a provider whose code is free, with the documented defaults', async () => {
		const fixture = providerFixture();

		const created = await fixture.service.createProvider({
			code: '  card-primary  ',
			name: '  Card (primary)  '
		} as never);

		expect(created).toMatchObject({
			code: 'card-primary',
			name: 'Card (primary)',
			isEnabled: true,
			isTestMode: false,
			sortOrder: 0,
			tenantId: TENANT,
			organizationId: ORG
		});
		expect(fixture.tables.payment_provider).toHaveLength(1);
	});

	// A code that is free is the ordinary state of the registry — every registration started that way —
	// so the uniqueness guard's read has to answer rather than refuse, or the registry can only ever be
	// populated by a migration and never by an operator.
	it('answers null for an identifier this organization does not have', async () => {
		const fixture = providerFixture([providerRow('card-primary')]);

		await expect(fixture.service.findProviderOrNull('no-such-provider')).resolves.toBeNull();
		await expect(fixture.service.findProviderOrNull('card-primary')).resolves.toMatchObject({
			id: 'card-primary'
		});
	});

	it('reports an unknown identifier as not found rather than answering with any row', async () => {
		// The read a caller uses when absence is not an answer: no row is invented for an identifier this
		// organization does not have, and the refusal is still the one the service states.
		const fixture = providerFixture([providerRow('card-primary')]);

		await expect(fixture.service.findProviderOrNull('no-such-provider')).resolves.toBeNull();
		await expect(fixture.service.findProviderOrFail('no-such-provider')).rejects.toBeInstanceOf(NotFoundException);
	});
});
