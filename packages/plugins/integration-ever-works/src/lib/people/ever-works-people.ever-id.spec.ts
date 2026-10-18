/**
 * Ever ID matching on the People tab (G-P1-6, plan 01 §3 step 1, decision D5): when an Ever Works member and a Gauzy
 * person carry the same Ever ID (Ever Works `everIdSubjects` ↔ Gauzy `zitadel_account`), they are paired
 * automatically; otherwise a verified e-mail is a suggestion and the admin confirms (as before). Every pairing keeps
 * how it was made (`matchedBy`: ever_id / verified_email / manual), and an admin who undoes an Ever ID pairing is not
 * overruled: that member is only suggested from then on.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		ExportRedacted: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		createSsrfSafeHttpsAgent: () => undefined,
		...Object.fromEntries(
			['Tenant', 'Organization', 'UserOrganization', 'Employee', 'EmployeeNotification', 'User', 'Invite', 'Role', 'IntegrationTenant', 'IntegrationSetting'].map(
				(name) => [name, entity(name)]
			)
		),
		InviteBulkCreateCommand: class {},
		isUniqueViolation: (error: unknown) => (error as { code?: string })?.code === '23505',
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, currentOrganizationId: () => null, hasPermission: () => true }
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { Employee, IntegrationSetting, Invite } from '@gauzy/core';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EverWorksInboundEvent, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import { EVER_ID_ACCOUNT_TABLE, everIdKey, everIdMatches } from './ever-works-ever-id';
import { EverWorksMember, EverWorksPeopleService } from './ever-works-people.service';

const ISSUER = 'https://id.example.test';

function member(userId: string, overrides: Partial<EverWorksMember> = {}): EverWorksMember {
	return {
		organizationId: 'ewo1',
		userId,
		username: userId.toLowerCase(),
		displayName: null,
		email: `${userId.toLowerCase()}@example.test`,
		emailVerified: true,
		avatarUrl: null,
		role: 'member',
		isActive: true,
		joinedAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		everIdSubjects: [],
		...overrides
	};
}

describe('everIdMatches', () => {
	const users = (entries: Array<[string, string, string[]]>) => new Map(entries.map(([issuer, subject, ids]) => [everIdKey({ issuer, subject }), new Set(ids)]));

	it('matches a member whose identity leads to exactly one person', () => {
		const matches = everIdMatches(
			[{ userId: 'U-ada', everIdSubjects: [{ issuer: ISSUER, subject: 'sub-ada' }] }],
			users([[ISSUER, 'sub-ada', ['user-ada']]]),
			new Map([['user-ada', 'E-ada' as never]])
		);
		expect([...matches]).toEqual([['U-ada', 'E-ada']]);
	});

	it('compares issuers without their trailing slashes, subjects exactly', () => {
		const people = new Map([['user-ada', 'E-ada' as never]]);
		expect(everIdMatches([{ userId: 'U', everIdSubjects: [{ issuer: `${ISSUER}/`, subject: 'sub-ada' }] }], users([[ISSUER, 'sub-ada', ['user-ada']]]), people).size).toBe(1);
		expect(everIdMatches([{ userId: 'U', everIdSubjects: [{ issuer: ISSUER, subject: 'SUB-ADA' }] }], users([[ISSUER, 'sub-ada', ['user-ada']]]), people).size).toBe(0);
		expect(everIdMatches([{ userId: 'U', everIdSubjects: [{ issuer: 'https://other.example.test', subject: 'sub-ada' }] }], users([[ISSUER, 'sub-ada', ['user-ada']]]), people).size).toBe(0);
	});

	it('leaves a member whose identities lead to several people, and a person several members lead to, unmatched', () => {
		const people = new Map([
			['user-1', 'E-1' as never],
			['user-2', 'E-2' as never]
		]);
		const ambiguous = everIdMatches(
			[{ userId: 'U', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }, { issuer: ISSUER, subject: 'b' }] }],
			users([
				[ISSUER, 'a', ['user-1']],
				[ISSUER, 'b', ['user-2']]
			]),
			people
		);
		expect(ambiguous.size).toBe(0);
		const shared = everIdMatches(
			[
				{ userId: 'U-1', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] },
				{ userId: 'U-2', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] }
			],
			users([[ISSUER, 'a', ['user-1']]]),
			people
		);
		expect(shared.size).toBe(0);
	});

	it('a person another member also leads to is never matched: ambiguous and excluded members claim too', () => {
		const people = new Map([
			['user-p', 'E-p' as never],
			['user-q', 'E-q' as never]
		]);
		const identities = users([
			[ISSUER, 'a', ['user-p']],
			[ISSUER, 'b', ['user-q']]
		]);
		// A leads to P and Q (ambiguous), B only to P: B is not matched with P.
		expect(
			everIdMatches(
				[
					{ userId: 'A', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }, { issuer: ISSUER, subject: 'b' }] },
					{ userId: 'B', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] }
				],
				identities,
				people
			).size
		).toBe(0);
		// A (declined) and B both lead to P: neither is matched; without A, B is.
		const both = [
			{ userId: 'A', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] },
			{ userId: 'B', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] }
		];
		expect(everIdMatches(both, identities, people, new Set(['A'])).size).toBe(0);
		expect([...everIdMatches([both[1]], identities, people)]).toEqual([['B', 'E-p']]);
	});

	it('ignores identities of users who are not a person of the organization who may be paired', () => {
		expect(everIdMatches([{ userId: 'U', everIdSubjects: [{ issuer: ISSUER, subject: 'a' }] }], users([[ISSUER, 'a', ['user-elsewhere']]]), new Map()).size).toBe(0);
	});
});

interface LinkRow {
	id: string;
	ewId: string;
	gauzyId: string;
	ewOnly: string | null;
	state: string;
}

function setup(
	options: {
		members?: EverWorksMember[];
		links?: Array<{ ewId: string; gauzyId: string; matchedBy?: string }>;
		accounts?: Array<{ issuer: string; subject: string; userId: string }>;
		accountsMissing?: boolean;
		declined?: string[];
		database?: { type: string; runner: { connect: jest.Mock; release: jest.Mock; query: jest.Mock } };
	} = {}
) {
	const links: LinkRow[] = (options.links ?? []).map((l, i) => ({
		id: `link-${i}`,
		ewId: l.ewId,
		gauzyId: l.gauzyId,
		ewOnly: l.matchedBy ? JSON.stringify({ matchedBy: l.matchedBy }) : null,
		state: 'ok'
	}));
	const employees = [
		{ id: 'E-ada', userId: 'user-ada', kind: 'human', user: { firstName: 'Ada', lastName: 'L', email: 'ada@example.test' } },
		{ id: 'E-bob', userId: 'user-bob', kind: 'human', user: { firstName: 'Bob', lastName: 'B', email: 'bob@example.test' } },
		{ id: 'E-cy', userId: 'user-cy', kind: 'human', user: { firstName: 'Cy', lastName: 'C', email: 'cy@example.test' } }
	];
	const settings: Array<{ id: string; integrationId: string; settingsName: string; settingsValue: string }> = options.declined
		? [{ id: 's-1', integrationId: 'm1', settingsName: EverWorksSettingName.PEOPLE_EVER_ID_DECLINED, settingsValue: JSON.stringify(options.declined) }]
		: [];
	const settingRepo = {
		findOne: jest.fn(async ({ where }: { where: { integrationId: string; settingsName: string } }) =>
			settings.find((s) => s.integrationId === where.integrationId && s.settingsName === where.settingsName) ?? null
		),
		update: jest.fn(async ({ id }: { id: string }, values: { settingsValue: string }) => {
			Object.assign(settings.find((s) => s.id === id) as object, values);
		}),
		create: jest.fn((values: Record<string, string>) => ({ ...values })),
		save: jest.fn(async (row: { integrationId: string; settingsName: string; settingsValue: string }) => {
			settings.push({ id: `s-${settings.length + 1}`, ...row });
			return row;
		})
	};
	const queried: string[] = [];
	const accountQuery = () => {
		const chain = {
			select: () => chain,
			addSelect: () => chain,
			from: (table: string) => {
				queried.push(table);
				return chain;
			},
			where: () => chain,
			andWhere: () => chain,
			getRawMany: async () => {
				if (options.accountsMissing) throw new Error('relation "zitadel_account" does not exist');
				return options.accounts ?? [];
			}
		};
		return chain;
	};
	const repositories = new Map<unknown, unknown>([
		[Employee, { find: jest.fn(async () => employees) }],
		[Invite, { createQueryBuilder: () => ({ select: () => chainAll(), where: () => chainAll() }) }],
		[EverWorksInboundEvent, { find: jest.fn(async () => []), update: jest.fn() }],
		[IntegrationSetting, settingRepo]
	]);
	function chainAll() {
		const chain: Record<string, unknown> = {};
		for (const name of ['select', 'where', 'andWhere', 'orderBy']) chain[name] = () => chain;
		chain['getMany'] = async () => [];
		return chain;
	}
	const manager = { getRepository: (target: unknown) => repositories.get(target) };
	const dataSource = {
		getRepository: (target: unknown) => repositories.get(target),
		transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(manager)),
		createQueryBuilder: jest.fn(accountQuery),
		createQueryRunner: () => options.database?.runner,
		driver: { escape: (name: string) => `"${name}"` },
		options: { type: options.database?.type ?? 'sqlite' }
	};
	const contexts = {
		forRequest: jest.fn(async () => ({
			tenantId: 't1',
			organizationId: 'o1',
			integrationTenantId: 'm1',
			connection: { id: 'c1' },
			everWorksOrganizationSlug: 'acme',
			mapping: { id: 'm1', settings: [] }
		}))
	};
	const connections = { client: () => ({ request: jest.fn(async () => ({ data: options.members ?? [], hasMore: false, nextCursor: null })) }) };
	const linkService = {
		list: jest.fn(async () => [...links]),
		byEw: jest.fn(async (_m: string, _t: string, ewId: string) => links.find((l) => l.ewId === ewId) ?? null),
		byGauzy: jest.fn(async (_m: string, _t: string, gauzyId: string) => links.find((l) => l.gauzyId === gauzyId) ?? null),
		record: jest.fn(async (input: { ewId: string; gauzyId: string; ewOnly?: Record<string, unknown> }) => {
			links.push({ id: `link-${links.length}`, ewId: input.ewId, gauzyId: input.gauzyId, ewOnly: input.ewOnly ? JSON.stringify(input.ewOnly) : null, state: 'ok' });
		}),
		remove: jest.fn(async (link: LinkRow) => {
			links.splice(links.indexOf(link), 1);
		})
	};
	const service = new EverWorksPeopleService(dataSource as never, contexts as never, connections as never, linkService as never, { execute: jest.fn() } as never);
	const declined = () => {
		const row = settings.find((s) => s.settingsName === EverWorksSettingName.PEOPLE_EVER_ID_DECLINED);
		return row ? (JSON.parse(row.settingsValue) as string[]) : [];
	};
	return { service, links, linkService, queried, declined, repositories };
}

const ada = (overrides: Partial<EverWorksMember> = {}) => member('U-ada', { everIdSubjects: [{ issuer: ISSUER, subject: 'sub-ada' }], ...overrides });
const adaAccount = { issuer: ISSUER, subject: 'sub-ada', userId: 'user-ada' };

describe('EverWorksPeopleService — Ever ID matching', () => {
	it('pairs a member and a person with the same Ever ID when the tab is read, recording matchedBy ever_id', async () => {
		const { service, linkService, queried } = setup({ members: [ada({ email: 'someone-else@example.test' })], accounts: [adaAccount] });
		const view = await service.people('m1' as never, 'o1' as never);

		expect(queried).toEqual([EVER_ID_ACCOUNT_TABLE]);
		expect(linkService.record).toHaveBeenCalledTimes(1);
		expect(linkService.record.mock.calls[0][0]).toEqual(
			expect.objectContaining({ entityType: EverWorksLinkType.MEMBER, ewId: 'U-ada', gauzyId: 'E-ada', ewOnly: expect.objectContaining({ matchedBy: 'ever_id' }) })
		);
		const row = view.members.find((m) => m.ewUserId === 'U-ada');
		expect(row).toEqual(expect.objectContaining({ linkedEmployeeId: 'E-ada', matchedBy: 'ever_id', suggestion: null }));
		expect(view.unmatchedEmployees.map((e) => e.employeeId)).not.toContain('E-ada');
	});

	it('prefers the Ever ID person over a verified-email suggestion of another person', async () => {
		const { service, linkService } = setup({ members: [ada({ email: 'bob@example.test' })], accounts: [adaAccount] });
		await service.people('m1' as never);
		expect(linkService.record.mock.calls[0][0]).toEqual(expect.objectContaining({ ewId: 'U-ada', gauzyId: 'E-ada' }));
	});

	it('never re-pairs a member or a person that is already paired', async () => {
		for (const links of [[{ ewId: 'U-ada', gauzyId: 'E-bob' }], [{ ewId: 'U-other', gauzyId: 'E-ada' }]]) {
			const { service, linkService } = setup({ members: [ada(), member('U-other')], accounts: [adaAccount], links });
			await service.people('m1' as never);
			expect(linkService.record).not.toHaveBeenCalled();
		}
	});

	it('falls back to the verified-email suggestion when Gauzy has no Ever ID data (no zitadel_account table)', async () => {
		const { service, linkService } = setup({ members: [ada({ email: 'ada@example.test' })], accountsMissing: true });
		const view = await service.people('m1' as never);
		expect(linkService.record).not.toHaveBeenCalled();
		expect(view.members[0].suggestion).toEqual({ employeeId: 'E-ada', reason: 'verified_email' });
	});

	it('does not query Ever ID links when no unpaired member carries an Ever ID', async () => {
		const { service, queried } = setup({ members: [member('U-ada')] });
		await service.people('m1' as never);
		expect(queried).toEqual([]);
	});

	it('keeps an admin undoing an Ever ID pairing: the member is declined, then only suggested (reason ever_id)', async () => {
		const { service, links, declined } = setup({ members: [ada({ email: 'nobody@example.test' })], accounts: [adaAccount], links: [{ ewId: 'U-ada', gauzyId: 'E-ada', matchedBy: 'ever_id' }] });
		await service.decide('m1' as never, { unlinks: ['U-ada'] });
		expect(links).toHaveLength(0);
		expect(declined()).toEqual(['U-ada']);

		const view = await service.people('m1' as never);
		expect(links).toHaveLength(0);
		expect(view.members[0]).toEqual(expect.objectContaining({ linkedEmployeeId: null, suggestion: { employeeId: 'E-ada', reason: 'ever_id' } }));
	});

	it('an explicit pairing of a declined member lifts the decline, and accepting the Ever ID suggestion records ever_id', async () => {
		const { service, links, declined } = setup({ members: [ada()], accounts: [adaAccount], declined: ['U-ada'] });
		await service.decide('m1' as never, { acceptSuggestions: true });
		expect(declined()).toEqual([]);
		expect(links).toEqual([expect.objectContaining({ ewId: 'U-ada', gauzyId: 'E-ada' })]);
		expect(JSON.parse(links[0].ewOnly as string)).toEqual(expect.objectContaining({ matchedBy: 'ever_id' }));
	});

	it('records how every People-tab pairing was made: an accepted e-mail suggestion, a hand-picked person', async () => {
		const { service, links } = setup({ members: [member('U-ada', { email: 'ada@example.test' }), member('U-bob')] });
		await service.decide('m1' as never, { links: [{ ewUserId: 'U-ada', employeeId: 'E-ada' as never }, { ewUserId: 'U-bob', employeeId: 'E-cy' as never }] });
		const by = new Map(links.map((l) => [l.ewId, JSON.parse(l.ewOnly as string).matchedBy]));
		expect(by.get('U-ada')).toBe('verified_email');
		expect(by.get('U-bob')).toBe('manual');
	});

	it('pairs and decides under one claim of the mapping (Postgres advisory lock), so neither undoes the other', async () => {
		const runner = {
			connect: jest.fn(async () => undefined),
			release: jest.fn(async () => undefined),
			query: jest.fn(async (sql: string, _params?: unknown[]) => (sql.includes('pg_try_advisory_lock') ? [{ locked: true }] : []))
		};
		const { service } = setup({ members: [ada()], accounts: [adaAccount], database: { type: 'postgres', runner } });
		await service.people('m1' as never);
		await service.decide('m1' as never, { unlinks: ['U-ada'] });
		const locks = runner.query.mock.calls.filter(([sql]) => String(sql).includes('pg_try_advisory_lock')).map(([, params]) => (params as string[])[0]);
		expect(locks).toEqual(['ever-works:people:m1', 'ever-works:people:m1']);
	});

	it('a pairing that lost a race on the link table reads as paired meanwhile: the tab is answered', async () => {
		const { service, linkService } = setup({ members: [ada()], accounts: [adaAccount] });
		linkService.record.mockRejectedValueOnce(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }));
		const view = await service.people('m1' as never);
		expect(view.members).toHaveLength(1);
	});

	it('a failure of the pairing, or of waking the inbox after it, still answers the tab', async () => {
		const failing = setup({ members: [ada()], accounts: [adaAccount] });
		failing.linkService.record.mockRejectedValueOnce(new Error('connection reset'));
		expect((await failing.service.people('m1' as never)).members).toHaveLength(1);

		const waking = setup({ members: [ada()], accounts: [adaAccount] });
		(waking.repositories.get(EverWorksInboundEvent) as { find: jest.Mock }).find.mockRejectedValueOnce(new Error('timeout'));
		const view = await waking.service.people('m1' as never);
		expect(view.members[0]).toEqual(expect.objectContaining({ linkedEmployeeId: 'E-ada', matchedBy: 'ever_id' }));
	});

	it('shows the match source of each pairing, an older pairing without one as manual', async () => {
		const { service } = setup({
			members: [member('U-ada'), member('U-bob'), member('U-cy')],
			links: [
				{ ewId: 'U-ada', gauzyId: 'E-ada', matchedBy: 'ever_id' },
				{ ewId: 'U-bob', gauzyId: 'E-bob', matchedBy: 'verified_email' },
				{ ewId: 'U-cy', gauzyId: 'E-cy' }
			]
		});
		const view = await service.people('m1' as never);
		expect(Object.fromEntries(view.members.map((m) => [m.ewUserId, m.matchedBy]))).toEqual({ 'U-ada': 'ever_id', 'U-bob': 'verified_email', 'U-cy': 'manual' });
	});
});
