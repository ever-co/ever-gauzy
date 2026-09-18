/**
 * The contact group — a named set of parties that prices and promotions target (schema chapter §7.1).
 *
 * Four rules, and the suite walks each of them: the code is unique per organization among live rows, the
 * code is trimmed before it is compared, a group the platform maintains is neither deletable nor
 * re-codable, and a rule-based group's membership is computed rather than written — which is why a
 * group cannot become a segment while hand-written members remain.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph — a unit test pays for the narrowest surface the module under test touches. The service under
 * test is the real one, over an in-memory table that applies the `where` the service states, so a read
 * that stopped scoping itself to the caller's organization is caught here rather than accommodated.
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

import { ContactGroupType } from '@gauzy/contracts';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { ContactGroupService } from './contact-group.service';
import {
	CONTACT_GROUP_EVENT_NAMES,
	ContactGroupEventPublisher,
	IContactGroupChangedEnvelope
} from './contact-group-event.publisher';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

type Row = Record<string, any>;

/**
 * The real publisher over a fan-out that records what it was handed.
 *
 * The real one, because what the announcement cases pin is the envelope a subscriber receives — its
 * event name, the topic it travels on and the payload it carries — and not that some collaborator was
 * called with something.
 */
function recordings() {
	const published: Array<{ eventName: string; tenantId: string; envelope: IContactGroupChangedEnvelope }> = [];
	const pubSub = {
		publish: jest.fn(async (eventName: string, tenantId: string, envelope: IContactGroupChangedEnvelope) => {
			published.push({ eventName, tenantId, envelope });

			return true;
		})
	};
	const catalogue = new SubscriptionCatalogue();
	const publisher = new ContactGroupEventPublisher(pubSub as never, catalogue);

	publisher.onModuleInit();

	return { published, pubSub, catalogue, publisher };
}

/**
 * An in-memory stand-in for the table and the repository the service writes through.
 *
 * The `where` the service states is applied — equality, with a missing column and a null column treated
 * as the same thing to the database — so a read that stopped narrowing is caught here. A row written
 * without `deletedAt` is live; the double does not model the repository's own soft-delete filter, which
 * is why the suite asserts on the column after a removal rather than on the read.
 */
function world(seed: Row[] = [], publisher = recordings().publisher) {
	const tables: Record<string, Row[]> = { contact_group: [...seed] };
	const reads: Row[] = [];
	let sequence = 0;

	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});

	const save = (row: Row): Row => {
		if (row.id) {
			const index = tables.contact_group.findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables.contact_group[index] = { ...tables.contact_group[index], ...row };

				return tables.contact_group[index];
			}
		}

		const created = { id: `group-${++sequence}`, createdAt: new Date(), ...row };

		tables.contact_group.push(created);

		return created;
	};

	const repository = {
		manager: { transaction: async (run: (manager: any) => Promise<any>) => run(repository) },
		metadata: { tableName: 'contact_group', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => {
			reads.push({ ...options.where });

			return tables.contact_group.filter((row) => matches(row, options.where));
		},
		findOne: async (options: any = {}) => tables.contact_group.find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables.contact_group.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save(row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables.contact_group.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables.contact_group[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};

	return {
		tables,
		reads,
		repository,
		service: new ContactGroupService(repository as never, {} as never, publisher as never),
		group: (id: string) => tables.contact_group.find((row) => row.id === id)
	};
}

/** One `contact_group` row, with the fields this suite reads. */
const groupRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Group ${id}`,
	code: `CODE_${id}`,
	type: ContactGroupType.STATIC,
	isSystem: false,
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

describe('ContactGroupService — the code a group is addressed by', () => {
	it('creates a group with its code trimmed, its kind defaulted and its maintenance flag cleared', async () => {
		const { service, group } = world();

		const created = await service.createGroup({ name: '  Wholesale  ', code: '  WHOLESALE  ' });

		expect(created.code).toBe('WHOLESALE');
		expect(created.name).toBe('Wholesale');
		expect(created.type).toBe(ContactGroupType.STATIC);
		expect(created.isSystem).toBe(false);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(group(created.id)).toBeDefined();
	});

	it('refuses a create body that claims the group is one the platform maintains', async () => {
		const { service } = world();

		// The flag is what makes a group undeletable, so a request body may not produce it: the create
		// path writes its own value over whatever was stated.
		const created = await service.createGroup({
			name: 'Guests',
			code: 'GUESTS',
			isSystem: true
		} as never);

		expect(created.isSystem).toBe(false);
	});

	it('creates a group the platform maintains through its own entry point', async () => {
		const { service } = world();

		const created = await service.createSystemGroup({ name: 'Guests', code: 'GUESTS' });

		expect(created.isSystem).toBe(true);
		expect(created.code).toBe('GUESTS');
	});

	it('refuses a group stated with no code', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.createGroup({ name: 'Nameless' } as never))).toContain(
			'CONTACT_GROUP_INVALID'
		);
		expect(await refusalOf(() => service.createGroup({ name: 'Blank', code: '   ' }))).toContain(
			'CONTACT_GROUP_INVALID'
		);
	});

	it('refuses a code a live group of the same organization already holds', async () => {
		const { service } = world([groupRow('group-1', { code: 'WHOLESALE' })]);

		expect(await refusalOf(() => service.createGroup({ name: 'Duplicate', code: 'wholesale' }))).toContain(
			'CONTACT_GROUP_CODE_TAKEN'
		);
	});

	it('allows a code another organization already holds, because the rule is per organization', async () => {
		const { service } = world([groupRow('group-1', { code: 'WHOLESALE', organizationId: OTHER_ORG })]);

		const created = await service.createGroup({ name: 'Wholesale', code: 'WHOLESALE' });

		expect(created.code).toBe('WHOLESALE');
	});

	it('resolves a group by code in the casing and padding the caller typed', async () => {
		const { service } = world([groupRow('group-1', { code: 'WHOLESALE' })]);

		const found = await service.findGroupByCode('  Wholesale ');

		expect(found?.id).toBe('group-1');
	});

	it('scopes every read to the caller tenant and organization', async () => {
		const { service, reads } = world([groupRow('group-1')]);

		await service.findGroupOrFail('group-1');

		expect(reads[0]).toMatchObject({ tenantId: TENANT, organizationId: ORG });
	});

	it('answers a miss with CONTACT_GROUP_NOT_FOUND rather than an empty row', async () => {
		const { service } = world();

		expect(await refusalOf(() => service.findGroupOrFail('missing'))).toContain('CONTACT_GROUP_NOT_FOUND');
	});
});

describe('ContactGroupService — the discount is a fraction and never a percentage', () => {
	it('stores a fraction between zero and one', async () => {
		const { service } = world();

		const created = await service.createGroup({ name: 'Wholesale', code: 'WHOLESALE', discountPercent: 0.1 });

		expect(created.discountPercent).toBe(0.1);
	});

	it('refuses ten, which is what a caller means by ten per cent and is not what the column holds', async () => {
		const { service } = world();

		expect(
			await refusalOf(() => service.createGroup({ name: 'Wholesale', code: 'WHOLESALE', discountPercent: 10 }))
		).toContain('CONTACT_GROUP_INVALID');
	});

	it('refuses a negative discount', async () => {
		const { service } = world();

		expect(
			await refusalOf(() =>
				service.createGroup({ name: 'Wholesale', code: 'WHOLESALE', discountPercent: -0.5 })
			)
		).toContain('CONTACT_GROUP_INVALID');
	});
});

describe('ContactGroupService — what an operator may change', () => {
	it('refuses a body that states the maintenance flag, in either direction', async () => {
		const { service } = world([groupRow('group-1')]);

		expect(await refusalOf(() => service.updateGroup('group-1', { isSystem: true } as never))).toContain(
			'CONTACT_GROUP_SYSTEM'
		);
		expect(await refusalOf(() => service.updateGroup('group-1', { isSystem: false } as never))).toContain(
			'CONTACT_GROUP_SYSTEM'
		);
	});

	it('renames a group', async () => {
		const { service, group } = world([groupRow('group-1')]);

		const updated = await service.updateGroup('group-1', { name: 'Wholesale accounts' });

		expect(updated.name).toBe('Wholesale accounts');
		expect(group('group-1')?.name).toBe('Wholesale accounts');
	});

	it('refuses to re-code a group the platform maintains', async () => {
		const { service } = world([groupRow('group-1', { code: 'GUESTS', isSystem: true })]);

		expect(await refusalOf(() => service.updateGroup('group-1', { code: 'VISITORS' }))).toContain(
			'CONTACT_GROUP_SYSTEM'
		);
	});

	it('lets a system group keep its own code, which is not a change', async () => {
		const { service } = world([groupRow('group-1', { code: 'GUESTS', isSystem: true })]);

		const updated = await service.updateGroup('group-1', { code: 'GUESTS', name: 'Guests and visitors' });

		expect(updated.name).toBe('Guests and visitors');
	});

	it('refuses a code another live group of the organization holds', async () => {
		const { service } = world([
			groupRow('group-1', { code: 'WHOLESALE' }),
			groupRow('group-2', { code: 'RETAIL' })
		]);

		expect(await refusalOf(() => service.updateGroup('group-2', { code: 'wholesale' }))).toContain(
			'CONTACT_GROUP_CODE_TAKEN'
		);
	});

	it('refuses to turn a group with hand-written members into a rule-based one', async () => {
		const { service } = world([groupRow('group-1')]);

		// Membership is read through the membership service, so the count arrives as an argument; the
		// refusal is what keeps a rule-based group from holding materialised membership nobody recomputes.
		expect(
			await refusalOf(() => service.updateGroup('group-1', { type: ContactGroupType.RULE_BASED }, 3))
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
	});

	it('turns an empty group into a rule-based one', async () => {
		const { service } = world([groupRow('group-1')]);

		const updated = await service.updateGroup('group-1', { type: ContactGroupType.RULE_BASED }, 0);

		expect(updated.type).toBe(ContactGroupType.RULE_BASED);
	});
});

describe('ContactGroupService — removal and membership ownership', () => {
	it('soft-deletes a group an operator maintains', async () => {
		const { service, group } = world([groupRow('group-1')]);

		await service.removeGroup('group-1');

		expect(group('group-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('refuses to delete a group the platform maintains', async () => {
		const { service, group } = world([groupRow('group-1', { isSystem: true })]);

		expect(await refusalOf(() => service.removeGroup('group-1'))).toContain('CONTACT_GROUP_SYSTEM');
		expect(group('group-1')?.deletedAt).toBeUndefined();
	});

	it('refuses a hand-written membership of a rule-based group, because its membership is computed', async () => {
		const { service } = world();

		expect(() => service.assertMembershipWritable({ type: ContactGroupType.RULE_BASED, code: 'VIP' } as never)).toThrow(
			/CONTACT_GROUP_MEMBER_INVALID/
		);
	});

	it('allows a hand-written membership of a static group', async () => {
		const { service } = world();

		expect(() =>
			service.assertMembershipWritable({ type: ContactGroupType.STATIC, code: 'WHOLESALE' } as never)
		).not.toThrow();
	});
});

describe('ContactGroupService — the list an operator reads', () => {
	it('narrows by kind and by maintenance', async () => {
		const { service } = world([
			groupRow('group-1', { type: ContactGroupType.STATIC }),
			groupRow('group-2', { type: ContactGroupType.RULE_BASED }),
			groupRow('group-3', { type: ContactGroupType.STATIC, isSystem: true })
		]);

		const statics = await service.listGroups({ type: ContactGroupType.STATIC });

		expect(statics.map((group) => group.id).sort()).toEqual(['group-1', 'group-3']);

		const system = await service.listGroups({ isSystem: true });

		expect(system.map((group) => group.id)).toEqual(['group-3']);
	});

	it('matches free text against the name, the code and the description', async () => {
		const { service } = world([
			groupRow('group-1', { name: 'Wholesale accounts' }),
			groupRow('group-2', { code: 'RETAIL', description: 'Walk-in customers' }),
			groupRow('group-3', { name: 'Guests', code: 'GUESTS' })
		]);

		expect((await service.listGroups({ search: 'whole' })).map((group) => group.id)).toEqual(['group-1']);
		expect((await service.listGroups({ search: 'walk-in' })).map((group) => group.id)).toEqual(['group-2']);
		expect((await service.listGroups({ search: 'guests' })).map((group) => group.id)).toEqual(['group-3']);
		expect(await service.listGroups({ search: 'nothing matches this' })).toEqual([]);
	});
});

describe('ContactGroupService — every write announces the fact the subscription carries', () => {
	it('announces a created group on the topic its event and tenant name', async () => {
		const announced = recordings();
		const { service } = world([], announced.publisher);

		const created = await service.createGroup({ name: 'Wholesale', code: 'WHOLESALE' });

		expect(announced.published).toHaveLength(1);

		const [fact] = announced.published;

		expect(fact.eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED);
		expect(fact.tenantId).toBe(TENANT);
		expect(fact.envelope).toMatchObject({
			name: 'contact_group.changed',
			action: 'created',
			tenantId: TENANT,
			organizationId: ORG,
			channelId: null,
			aggregate: { type: 'ContactGroup', id: created.id },
			group: created,
			data: created
		});
	});

	it('announces an updated group with the row the write stored', async () => {
		const announced = recordings();
		const { service } = world([groupRow('group-1')], announced.publisher);

		const updated = await service.updateGroup('group-1', { name: 'Renamed' });

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED);
		expect(announced.published[0].envelope).toMatchObject({
			action: 'updated',
			group: updated,
			aggregate: { type: 'ContactGroup', id: 'group-1' }
		});
		expect((announced.published[0].envelope.group as Row).name).toBe('Renamed');
	});

	it('announces a removed group from the row the removal acted on', async () => {
		const announced = recordings();
		const { service, group } = world([groupRow('group-1')], announced.publisher);

		await service.removeGroup('group-1');

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED);
		expect(announced.published[0].envelope).toMatchObject({
			action: 'deleted',
			aggregate: { type: 'ContactGroup', id: 'group-1' }
		});
		// The removal happened, and the announcement was made before the method's own re-read: a removed
		// row is absent to the reads this service performs, so a subscriber must not depend on that read
		// having succeeded.
		expect((announced.published[0].envelope.group as Row).id).toBe('group-1');
		expect(group('group-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('announces a group the platform seeds, which no request created', async () => {
		const announced = recordings();
		const { service } = world([], announced.publisher);

		const seeded = await service.createSystemGroup({ name: 'Guests', code: 'GUESTS' });

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].envelope).toMatchObject({ action: 'created', group: seeded });
		expect((seeded as Row).isSystem).toBe(true);
	});

	it('announces nothing for a write that was refused', async () => {
		const announced = recordings();
		const { service } = world([groupRow('group-1', { isSystem: true })], announced.publisher);

		await refusalOf(() => service.removeGroup('group-1'));

		// A refusal is not a change: a subscriber told about a removal that did not happen would cache
		// a group the platform still has.
		expect(announced.published).toEqual([]);
	});

	it('publishes on the credential’s tenant, never on a tenant a row claims', async () => {
		const announced = recordings();

		// A row whose tenancy disagrees with the request is not a state the write paths can produce —
		// every read here is scoped to the caller — and the publisher still cannot be steered by one:
		// the credential's tenant is what the topic names, which is what makes the topic a boundary
		// rather than a routing hint.
		await announced.publisher.groupChanged(
			{ ...groupRow('group-1'), tenantId: '00000000-0000-4000-8000-000000000009' } as never,
			'updated'
		);

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].tenantId).toBe(TENANT);
		expect(announced.published[0].eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED);
	});
});
