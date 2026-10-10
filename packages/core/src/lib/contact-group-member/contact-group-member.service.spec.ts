/**
 * The membership pivot — who is in which group, until when, and who put them there (schema chapter §7.2).
 *
 * Five rules, and the suite walks each of them: one row per pair with a lapsed membership refreshed
 * rather than duplicated, a window that has already closed is refused, a lapsed row counts as absent
 * before the cleanup job removes it, removal is scoped by provenance so an operator never removes what an
 * evaluation owns, and a rule-based group's membership is never written by hand.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. Both services under test are the real ones, over two in-memory tables that apply the `where`
 * they state, so a read that stopped scoping itself is caught here rather than accommodated.
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

import { ContactGroupSource, ContactGroupType } from '@gauzy/contracts';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { ContactGroupService } from '../contact-group/contact-group.service';
import {
	CONTACT_GROUP_EVENT_NAMES,
	ContactGroupEventPublisher,
	IContactGroupChangedEnvelope
} from '../contact-group/contact-group-event.publisher';
import { ContactGroupMemberService } from './contact-group-member.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const GROUP = 'group-1';
const RULE_GROUP = 'group-2';
const CUSTOMER = 'contact-1';
const OTHER_CUSTOMER = 'contact-2';

const HOUR = 60 * 60 * 1000;

type Row = Record<string, any>;

/**
 * The real publisher over a fan-out that records what it was handed.
 *
 * The real one, because what the membership cases pin is the envelope a subscriber receives — the
 * catalogue's own event name, the topic it travels on and the payload it carries — and not that some
 * collaborator was called with something.
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
 * An in-memory stand-in for the two tables and the repositories the services write through.
 *
 * The `where` the service states is applied, so a read that stopped narrowing is caught here. `order` is
 * not modelled: no case in this suite depends on the order of a list, and a double that sorted would be
 * asserting its own comparator.
 */
function world(seed: { groups?: Row[]; members?: Row[] } = {}, publisher = recordings().publisher) {
	const tables: Record<string, Row[]> = {
		contact_group: [...(seed.groups ?? [])],
		contact_group_member: [...(seed.members ?? [])]
	};
	let sequence = 0;

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

	const repository = (table: string) => {
		const repo: any = {
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
		};

		repo.manager = { transaction: async (run: (manager: any) => Promise<any>) => run(repo) };

		return repo;
	};

	const groupRepository = repository('contact_group');
	const memberRepository = repository('contact_group_member');
	const groupService = new ContactGroupService(groupRepository as never, {} as never, publisher as never);
	const memberService = new ContactGroupMemberService(
		memberRepository as never,
		{} as never,
		groupService,
		publisher as never
	);

	return {
		tables,
		groupService,
		memberService,
		member: (id: string) => tables.contact_group_member.find((row) => row.id === id),
		membersOf: (groupId: string) => tables.contact_group_member.filter((row) => row.groupId === groupId)
	};
}

/** One `contact_group` row. */
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

/** One `contact_group_member` row. */
const memberRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	customerId: CUSTOMER,
	groupId: GROUP,
	assignedAt: new Date(Date.now() - HOUR),
	source: ContactGroupSource.MANUAL,
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

describe('ContactGroupMemberService — writing one membership', () => {
	it('records a hand-written membership with the instant it was granted', async () => {
		const { memberService, member, membersOf } = world({ groups: [groupRow(GROUP)] });

		const created = await memberService.addMember(GROUP, { customerId: CUSTOMER });

		expect(created.source).toBe(ContactGroupSource.MANUAL);
		expect(created.groupId).toBe(GROUP);
		expect(created.customerId).toBe(CUSTOMER);
		expect(created.assignedAt).toBeInstanceOf(Date);
		expect(created.tenantId).toBe(TENANT);
		expect(created.organizationId).toBe(ORG);
		expect(member(created.id)).toBeDefined();
		expect(membersOf(GROUP)).toHaveLength(1);
	});

	it('refuses an unknown group rather than writing an orphan membership', async () => {
		const { memberService, tables } = world();

		expect(await refusalOf(() => memberService.addMember('missing', { customerId: CUSTOMER }))).toContain(
			'CONTACT_GROUP_NOT_FOUND'
		);
		expect(tables.contact_group_member).toHaveLength(0);
	});

	it('refuses a hand-written membership of a rule-based group', async () => {
		const { memberService, tables } = world({
			groups: [groupRow(RULE_GROUP, { type: ContactGroupType.RULE_BASED })]
		});

		expect(
			await refusalOf(() => memberService.addMember(RULE_GROUP, { customerId: CUSTOMER }))
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
		expect(tables.contact_group_member).toHaveLength(0);
	});

	it('refuses a second live membership for the same pair', async () => {
		const { memberService, membersOf } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1')]
		});

		expect(await refusalOf(() => memberService.addMember(GROUP, { customerId: CUSTOMER }))).toContain(
			'CONTACT_GROUP_MEMBER_INVALID'
		);
		expect(membersOf(GROUP)).toHaveLength(1);
	});

	it('refuses a membership whose window has already closed', async () => {
		const { memberService, tables } = world({ groups: [groupRow(GROUP)] });

		expect(
			await refusalOf(() =>
				memberService.addMember(GROUP, {
					customerId: CUSTOMER,
					expiresAt: new Date(Date.now() - HOUR)
				})
			)
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
		expect(tables.contact_group_member).toHaveLength(0);
	});

	it('refreshes the row a lapsed membership left behind instead of writing a second one', async () => {
		const { memberService, membersOf } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { expiresAt: new Date(Date.now() - HOUR) })]
		});

		const refreshed = await memberService.addMember(GROUP, {
			customerId: CUSTOMER,
			expiresAt: new Date(Date.now() + 24 * HOUR)
		});

		expect(refreshed.id).toBe('member-1');
		expect(membersOf(GROUP)).toHaveLength(1);
		expect(new Date(refreshed.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
	});

	it('refuses a hand-written membership for a pair a live derived membership already holds', async () => {
		const { memberService, membersOf } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { source: ContactGroupSource.RULE })]
		});

		expect(await refusalOf(() => memberService.addMember(GROUP, { customerId: CUSTOMER }))).toContain(
			'CONTACT_GROUP_MEMBER_INVALID'
		);
		expect(membersOf(GROUP)).toHaveLength(1);
	});

	it('writes a list of memberships, and refuses the whole list when one pair is already a live member', async () => {
		const { memberService, membersOf } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { customerId: OTHER_CUSTOMER })]
		});

		const written = await memberService.addMembers(GROUP, [
			{ customerId: 'contact-3' },
			{ customerId: 'contact-4' }
		]);

		expect(written).toHaveLength(2);

		// Nothing is half-applied: the duplicate is found before the first row of the list is written.
		expect(
			await refusalOf(() =>
				memberService.addMembers(GROUP, [{ customerId: 'contact-5' }, { customerId: OTHER_CUSTOMER }])
			)
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
		expect(membersOf(GROUP).map((row) => row.customerId).sort()).toEqual(
			['contact-3', 'contact-4', OTHER_CUSTOMER].sort()
		);
	});

	it('refuses a list that names the same party twice', async () => {
		const { memberService, membersOf } = world({ groups: [groupRow(GROUP)] });

		expect(
			await refusalOf(() =>
				memberService.addMembers(GROUP, [{ customerId: CUSTOMER }, { customerId: CUSTOMER }])
			)
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
		expect(membersOf(GROUP)).toHaveLength(0);
	});
});

describe('ContactGroupMemberService — a lapsed membership is absent', () => {
	it('treats a row whose window has passed as not a member', async () => {
		const { memberService } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { expiresAt: new Date(Date.now() - HOUR) })]
		});

		expect(await memberService.isMember(CUSTOMER, GROUP)).toBe(false);
		expect(await memberService.listGroupIdsOfCustomer(CUSTOMER)).toEqual([]);
	});

	it('treats a row whose window is open as a member', async () => {
		const { memberService } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { expiresAt: new Date(Date.now() + HOUR) })]
		});

		expect(await memberService.isMember(CUSTOMER, GROUP)).toBe(true);
		expect(await memberService.listGroupIdsOfCustomer(CUSTOMER)).toEqual([GROUP]);
	});

	it('answers membership at the instant it is asked about, so a historical price resolves as it stood', async () => {
		const window = new Date('2026-01-01T00:00:00.000Z');
		const { memberService } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { expiresAt: new Date('2026-02-01T00:00:00.000Z') })]
		});

		expect(await memberService.isMember(CUSTOMER, GROUP, window)).toBe(true);
		expect(await memberService.isMember(CUSTOMER, GROUP, new Date('2026-03-01T00:00:00.000Z'))).toBe(false);
	});

	it('hides lapsed rows from the member list unless the caller asks for them', async () => {
		const { memberService } = world({
			groups: [groupRow(GROUP)],
			members: [
				memberRow('member-1'),
				memberRow('member-2', { customerId: OTHER_CUSTOMER, expiresAt: new Date(Date.now() - HOUR) })
			]
		});

		expect((await memberService.listMembers(GROUP)).map((member) => member.id)).toEqual(['member-1']);
		expect((await memberService.listMembers(GROUP, { includeExpired: true })).map((member) => member.id).sort()).toEqual(
			['member-1', 'member-2']
		);
	});

	it('removes the lapsed rows, which is what the nightly sweep does', async () => {
		const { memberService, member } = world({
			groups: [groupRow(GROUP)],
			members: [
				memberRow('member-1'),
				memberRow('member-2', { customerId: OTHER_CUSTOMER, expiresAt: new Date(Date.now() - HOUR) })
			]
		});

		const removed = await memberService.removeExpired();

		expect(removed.map((row) => row.id)).toEqual(['member-2']);
		expect(member('member-2')?.deletedAt).toBeInstanceOf(Date);
		expect(member('member-1')?.deletedAt).toBeUndefined();
	});
});

describe('ContactGroupMemberService — provenance is what may remove a row', () => {
	it('removes the hand-written row and leaves the derived one alone', async () => {
		const { memberService, member } = world({
			groups: [groupRow(GROUP)],
			members: [
				memberRow('member-1', { source: ContactGroupSource.MANUAL }),
				memberRow('member-2', { source: ContactGroupSource.RULE })
			]
		});

		await memberService.removeMember(GROUP, CUSTOMER, ContactGroupSource.MANUAL);

		expect(member('member-1')?.deletedAt).toBeInstanceOf(Date);
		expect(member('member-2')?.deletedAt).toBeUndefined();
	});

	it('removes the imported row when the caller names that provenance', async () => {
		const { memberService, member } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { source: ContactGroupSource.IMPORT })]
		});

		await memberService.removeMember(GROUP, CUSTOMER, ContactGroupSource.IMPORT);

		expect(member('member-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('answers a removal of a membership that is not there with CONTACT_GROUP_MEMBER_NOT_FOUND', async () => {
		const { memberService } = world({ groups: [groupRow(GROUP)] });

		expect(await refusalOf(() => memberService.removeMember(GROUP, CUSTOMER))).toContain(
			'CONTACT_GROUP_MEMBER_NOT_FOUND'
		);
	});

	it('refuses a materialised write that claims the hand-written provenance', async () => {
		const { memberService, tables } = world({ groups: [groupRow(GROUP)] });

		expect(
			await refusalOf(() => memberService.replaceMembersOfSource(GROUP, ContactGroupSource.MANUAL, [CUSTOMER]))
		).toContain('CONTACT_GROUP_MEMBER_INVALID');
		expect(tables.contact_group_member).toHaveLength(0);
	});

	it('replaces a segment wholesale while leaving hand-written memberships untouched', async () => {
		const { memberService, member } = world({
			groups: [groupRow(GROUP)],
			members: [
				memberRow('member-1', { source: ContactGroupSource.MANUAL }),
				memberRow('member-2', { customerId: 'contact-3', source: ContactGroupSource.RULE }),
				memberRow('member-3', { customerId: 'contact-4', source: ContactGroupSource.RULE })
			]
		});

		const now = await memberService.replaceMembersOfSource(GROUP, ContactGroupSource.RULE, ['contact-3', 'contact-5']);

		expect(now.map((row) => row.customerId).sort()).toEqual(['contact-3', 'contact-5']);
		// The party the evaluation no longer names loses its derived row...
		expect(member('member-3')?.deletedAt).toBeInstanceOf(Date);
		// ...and the party an operator added is not the evaluation's to remove.
		expect(member('member-1')?.deletedAt).toBeUndefined();
		expect(member('member-2')?.deletedAt).toBeUndefined();
	});

	it('replaces an imported set wholesale, which is what a second import does', async () => {
		const { memberService, member } = world({
			groups: [groupRow(GROUP)],
			members: [memberRow('member-1', { source: ContactGroupSource.IMPORT })]
		});

		await memberService.replaceMembersOfSource(GROUP, ContactGroupSource.IMPORT, [OTHER_CUSTOMER]);

		expect(member('member-1')?.deletedAt).toBeInstanceOf(Date);
	});
});

describe('ContactGroupMemberService — every membership write announces the fact the subscription carries', () => {
	it('announces an assignment under the catalogue’s own event name and payload', async () => {
		const announced = recordings();
		const { memberService } = world({ groups: [groupRow(GROUP)] }, announced.publisher);

		await memberService.addMember(GROUP, { customerId: CUSTOMER });

		expect(announced.published).toHaveLength(1);

		const [fact] = announced.published;

		expect(fact.eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED);
		expect(fact.tenantId).toBe(TENANT);
		// The payload is the one the event catalogue states for this event — `groupId`, `customerIds[]`,
		// `source` — and not a second shape invented for the stream.
		expect(fact.envelope.data).toEqual({
			groupId: GROUP,
			customerIds: [CUSTOMER],
			source: ContactGroupSource.MANUAL
		});
		expect(fact.envelope).toMatchObject({
			name: 'contact_group.assigned',
			action: 'assigned',
			tenantId: TENANT,
			organizationId: ORG,
			channelId: null,
			aggregate: { type: 'ContactGroup', id: GROUP },
			customerIds: [CUSTOMER],
			source: ContactGroupSource.MANUAL
		});
		// The group a subscriber resolves travels with the fact, so a selection needs no second read.
		expect((fact.envelope.group as Row).id).toBe(GROUP);
	});

	it('announces a whole list as one fact, carrying the parties it named', async () => {
		const announced = recordings();
		const { memberService } = world({ groups: [groupRow(GROUP)] }, announced.publisher);

		await memberService.addMembers(GROUP, [{ customerId: 'contact-3' }, { customerId: 'contact-4' }]);

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED);
		expect(announced.published[0].envelope.customerIds).toEqual(['contact-3', 'contact-4']);
		expect(announced.published[0].envelope.data).toEqual({
			groupId: GROUP,
			customerIds: ['contact-3', 'contact-4'],
			source: ContactGroupSource.MANUAL
		});
	});

	it('announces a withdrawal under the catalogue’s own event name, with the provenance it removed', async () => {
		const announced = recordings();
		const { memberService } = world(
			{ groups: [groupRow(GROUP)], members: [memberRow('member-1', { source: ContactGroupSource.IMPORT })] },
			announced.publisher
		);

		await memberService.removeMember(GROUP, CUSTOMER, ContactGroupSource.IMPORT);

		expect(announced.published).toHaveLength(1);
		expect(announced.published[0].eventName).toBe(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_UNASSIGNED);
		expect(announced.published[0].envelope).toMatchObject({
			name: 'contact_group.unassigned',
			action: 'unassigned',
			aggregate: { type: 'ContactGroup', id: GROUP },
			customerIds: [CUSTOMER],
			source: ContactGroupSource.IMPORT
		});
	});

	it('announces nothing for a membership write that was refused', async () => {
		const announced = recordings();
		const { memberService } = world(
			{ groups: [groupRow(RULE_GROUP, { type: ContactGroupType.RULE_BASED })] },
			announced.publisher
		);

		await refusalOf(() => memberService.addMember(RULE_GROUP, { customerId: CUSTOMER }));

		// A refusal is not a change: a subscriber told about a membership the platform refused would
		// price a party into a segment it is not in.
		expect(announced.published).toEqual([]);
	});
});
