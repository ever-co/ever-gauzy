/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationTeamController } from './organization-team.controller';
import { OrganizationTeamResolver } from './organization-team.resolver';
import { OrganizationTeamCreateCommand } from './commands';
import { GetOrganizationTeamStatisticQuery } from './queries';

/**
 * The team over GraphQL.
 *
 * The delivered REST routes serve a list, the caller's own list, one team, a count, a filing, an
 * edit, two removals, a withdrawal and a restoration, and the removal of a user from the teams they
 * joined. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and both lists are
 *   connections with the platform's own cursor codec behind them, so a cursor obtained over REST
 *   resumes here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command or query, that the
 *   REST route reaches — including the one-row field, whose route dispatches a statistics query
 *   rather than calling the plain finder, and the create, whose route dispatches a command because
 *   filing a team provisions the vocabularies the rest of the platform reads;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — including the two inherited lifecycle moves, whose routes declare none of their own and
 *   therefore run under the controller's class-level pair;
 * - the members the delivered read produces are what the object type carries, and every collection it
 *   does not join is absent from both the type and the filter;
 * - the SDL and the evaluator cannot disagree: every filter member the schema offers is one the
 *   evaluator knows, and every sort key the enum offers is one the allow-list accepts.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ACME_TEAM = '00000000-0000-4000-8000-000000000010';
const ZEPHYR_TEAM = '00000000-0000-4000-8000-000000000011';
const MEMBER = '00000000-0000-4000-8000-000000000020';
const MANAGER = '00000000-0000-4000-8000-000000000021';
const TAG = '00000000-0000-4000-8000-000000000030';
const PROJECT = '00000000-0000-4000-8000-000000000031';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them.
 */
const ROWS = [
	{
		id: ZEPHYR_TEAM,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Zephyr',
		color: 'blue',
		emoji: '🌪️',
		teamSize: '9',
		logo: null,
		prefix: 'ZEP',
		profile_link: null,
		public: false,
		shareProfileView: true,
		requirePlanToTrack: false,
		imageId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: ACME_TEAM,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Acme',
		color: 'red',
		emoji: null,
		teamSize: '4',
		logo: null,
		prefix: 'ACM',
		profile_link: null,
		public: true,
		shareProfileView: true,
		requirePlanToTrack: false,
		imageId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over scripted buses and a scripted service. */
function surfaces() {
	const organizationTeamService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findMyTeams: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[1]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		update: jest.fn().mockResolvedValue(ROWS[1]),
		deleteTeam: jest.fn().mockResolvedValue({ affected: 1 }),
		existTeamsAsMember: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[1], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[1])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };
	const queryBus = { execute: jest.fn().mockResolvedValue(ROWS[1]) };

	return {
		organizationTeamService,
		commandBus,
		queryBus,
		resolver: new OrganizationTeamResolver(
			organizationTeamService as never,
			commandBus as never,
			queryBus as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * The root fields this domain contributes.
 *
 * The concept's name is a *prefix* of its neighbours' — `organizationTeamSetting` and every other
 * field that begins with the same fifteen letters — so the match is anchored at both ends rather than
 * a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		/^(organizationTeam(s|Count)?|myOrganizationTeams|createOrganizationTeam|updateOrganizationTeam|deleteOrganizationTeam|softDeleteOrganizationTeam|recoverOrganizationTeam|removeUserFromOrganizationTeams)$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The members one printed input type declares, as the schema states them. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The member names of one printed input type, in the order the schema declares them. */
function inputMembers(name: string): string[] {
	return [...inputBody(name).matchAll(/^\s+(\w+):/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationTeamController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. An *empty* declaration counts as a
 * declaration here; this controller declares none of them empty, and the two lifecycle routes it
 * inherits declare nothing at all.
 */
function permissionOfRoute(controller: typeof OrganizationTeamController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationTeamController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationTeamResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The class-level pair the controller states and every field that mirrors a route declaring none carries. */
const CLASS_PERMISSIONS = [PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT];

describe('OrganizationTeamResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two connection queries, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'organizationTeams',
				'myOrganizationTeams',
				'organizationTeam',
				'organizationTeamCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOrganizationTeam',
				'updateOrganizationTeam',
				'deleteOrganizationTeam',
				'removeUserFromOrganizationTeams',
				'softDeleteOrganizationTeam',
				'recoverOrganizationTeam'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list three times — `GET /`, `GET /pagination` and `GET /me` — and
		// the first two answer one question, so the surface states it once: a second root field for the
		// paginated spelling would be a second surface that could disagree with this one. The paginated
		// spelling is a read route like the list it folds into, and the field that folds it states that
		// route's permission rather than a page's own.
		expect(ownedRootFields('Query')).toEqual([
			'myOrganizationTeams',
			'organizationTeam',
			'organizationTeamCount',
			'organizationTeams'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationTeam',
			'deleteOrganizationTeam',
			'recoverOrganizationTeam',
			'removeUserFromOrganizationTeams',
			'softDeleteOrganizationTeam',
			'updateOrganizationTeam'
		]);
		expect(permissionOfRoute(OrganizationTeamController, 'pagination')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TEAM_VIEW
		]);
	});

	it('declares the connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type OrganizationTeamConnection \{\s*nodes: \[OrganizationTeam!\]!\s*edges: \[OrganizationTeamEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OrganizationTeamEdge \{\s*node: OrganizationTeam!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OrganizationTeamFilter \{/);
		expect(printed).toMatch(/input OrganizationTeamSort \{/);
		expect(printed).toMatch(/enum OrganizationTeamSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('carries the row’s own columns and the one relation the delivered read always joins', () => {
		const body = typeBody('OrganizationTeam');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/color: String/);
		expect(body).toMatch(/emoji: String/);
		expect(body).toMatch(/teamSize: String/);
		expect(body).toMatch(/public: Boolean/);
		expect(body).toMatch(/shareProfileView: Boolean/);
		expect(body).toMatch(/requirePlanToTrack: Boolean/);
		// `profile_link` is spelled with the underscore the column carries, so the two protocols answer
		// one row under one set of member names.
		expect(body).toMatch(/profile_link: String/);
		// The logo relation is declared eager on the entity, so it travels on every row either read
		// returns and both the member and its identifier are always answered.
		expect(body).toMatch(/image: ImageAsset/);
		expect(body).toMatch(/imageId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a team would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('carries no collection the delivered read does not join, and no relation it does not load', () => {
		const body = typeBody('OrganizationTeam');

		// These are the pivots and the reverse sides of relations: none of them is a column of this row
		// and none is joined by a read that names no relation, so a field for one would answer null on
		// exactly the rows this surface serves. Each is read from the surface that owns it.
		for (const collection of [
			'members',
			'managers',
			'projects',
			'tags',
			'tasks',
			'modules',
			'goals',
			'statuses',
			'priorities',
			'sizes',
			'versions',
			'views',
			'labels',
			'issueTypes',
			'dailyPlans',
			'equipmentSharings',
			'assignedComments',
			'requestApprovals'
		]) {
			expect(body).not.toMatch(new RegExp(`\\b${collection}:`));
		}
		// The relations the row names by identifier are carried as identifiers, never as rows.
		expect(body).not.toMatch(/\borganization:/);
		expect(body).not.toMatch(/\btenant:/);
	});

	it('declares a filter member for every field the evaluator knows, and no relation', async () => {
		const members = inputMembers('OrganizationTeamFilter').filter(
			(member) => !['and', 'or', 'not'].includes(member)
		);

		expect(members).toEqual(
			expect.arrayContaining(['id', 'name', 'profile_link', 'public', 'imageId', 'organizationId', 'createdAt'])
		);
		// A relation the read does not join is not filterable: a filter on one would be evaluated
		// against a row that carries none of it and would select nothing at all.
		for (const relation of ['members', 'projects', 'tags', 'tasks', 'organization', 'tenant']) {
			expect(members).not.toContain(relation);
		}

		// Every member the schema offers is one the evaluator accepts, which is the parity a generated
		// input and a hand-written allow-list can otherwise lose without either of them looking wrong.
		for (const member of members) {
			const connection = await surfaces().resolver.organizationTeams({ [member]: {} });

			expect(connection.totalCount).toBe(ROWS.length);
		}
	});

	it('declares a sort key for every value the sort enum offers', async () => {
		const values = (printed.match(/enum OrganizationTeamSortField \{([\s\S]*?)\n\}/)?.[1] ?? '')
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);

		expect(values).toEqual(['createdAt', 'updatedAt', 'name']);

		for (const field of values) {
			const connection = await surfaces().resolver.organizationTeams(undefined, [{ field, direction: 'ASC' }]);

			expect(connection.totalCount).toBe(ROWS.length);
		}
	});

	it('offers no argument it cannot honour', () => {
		// The delivered count route passes its query string through as the store's own `where`, which
		// this surface cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/organizationTeamCount\(/);
		// The delivered list method reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/organizationTeams\([^)]*withDeleted/);
		// The caller's own list narrows by who is asking, so no argument here names an employee: a
		// caller cannot read anyone else's teams through it.
		expect(printed).not.toMatch(/myOrganizationTeams\([^)]*employeeId/);
	});

	it('declares only the create members the delivered write reads, and not one it discards', () => {
		const body = inputBody('CreateOrganizationTeamInput');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/organizationId: ID!/);
		expect(body).toMatch(/profile_link: String/);
		expect(body).toMatch(/memberIds: \[ID!\]/);
		expect(body).toMatch(/managerIds: \[ID!\]/);
		// The relations are stated by identifier rather than as rows, because an identifier is what the
		// delivered write persists.
		expect(body).toMatch(/tagIds: \[ID!\]/);
		expect(body).toMatch(/projectIds: \[ID!\]/);
		expect(body).not.toMatch(/\btags:/);
		expect(body).not.toMatch(/\bprojects:/);
		// The delivered body validates the presentation members and the delivered create read then
		// builds its row from an explicit set of members that does not include them: a filing that
		// stated one would accept a value and write nothing.
		for (const discarded of ['color', 'emoji', 'teamSize', 'shareProfileView', 'requirePlanToTrack']) {
			expect(body).not.toMatch(new RegExp(`\\b${discarded}:`));
		}
		// No member names the tenant, because the tenant comes from the credential on every write here.
		expect(body).not.toContain('tenantId');
	});

	it('declares the presentation members on the edit only, which is where the delivered body writes them', () => {
		const create = inputBody('CreateOrganizationTeamInput');
		const update = inputBody('UpdateOrganizationTeamInput');

		expect(update).toMatch(/id: ID!/);
		expect(update).toMatch(/name: String$/m);
		expect(update).toMatch(/organizationId: ID!/);

		// The edit hands its whole body to the persist call, so the row's presentation is written there
		// and nowhere else.
		for (const member of ['color', 'emoji', 'teamSize', 'shareProfileView', 'requirePlanToTrack']) {
			expect(update).toMatch(new RegExp(`\\b${member}:`));
			expect(create).not.toMatch(new RegExp(`\\b${member}:`));
		}

		expect(update).not.toContain('tenantId');
	});

	it('declares the removal’s options as the criterion the delivered route carries, and never a tenant member', () => {
		const body = inputBody('OrganizationTeamDeleteInput');

		expect(body).toMatch(/organizationId: ID!/);
		// The delivered query DTO picks the organization and the tenant; the tenant a write runs under
		// comes from the credential, so a caller could only ever restate its own.
		expect(body).not.toContain('tenantId');
		// The argument itself is optional, because the delivered route's options are.
		expect(printed).toMatch(/deleteOrganizationTeam\(id: ID!, options: OrganizationTeamDeleteInput\): Boolean!/);
	});
});

describe('OrganizationTeamResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, organizationTeamService } = surfaces();

		const connection = await resolver.organizationTeams(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs when its query string states nothing.
		expect(organizationTeamService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ACME_TEAM);
	});

	it('orders by name when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.organizationTeams();

		expect(connection.nodes.map((node) => node.id)).toEqual([ACME_TEAM, ZEPHYR_TEAM]);
	});

	it('answers the caller’s own list through the reader that resolves it from the credential', async () => {
		const { resolver, organizationTeamService } = surfaces();

		const connection = await resolver.myOrganizationTeams(undefined, undefined, undefined, 20);

		// The read the `GET /me` route performs, with the route's own defaults for an unstated query
		// string: the narrowing by who is asking is the read's own and is not stated here.
		expect(organizationTeamService.findMyTeams).toHaveBeenCalledWith({});
		expect(organizationTeamService.findAll).not.toHaveBeenCalled();
		expect(connection.totalCount).toBe(2);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationTeams({ name: { ilike: 'acm%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ACME_TEAM]);

		const byVisibility = await resolver.organizationTeams({ public: { eq: true } });
		expect(byVisibility.nodes.map((node) => node.id)).toEqual([ACME_TEAM]);

		const byPrefix = await resolver.organizationTeams({ prefix: { in: ['ZEP'] } });
		expect(byPrefix.nodes.map((node) => node.id)).toEqual([ZEPHYR_TEAM]);

		// A relation the read does not join is not a filter, so it is refused rather than evaluated
		// against a row that carries none of it.
		const refusal = await resolver
			.organizationTeams({ members: { eq: MEMBER } })
			.catch((thrown) => thrown);
		expect(isRefusal(refusal)).toBe(true);
		expect((refusal as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.organizationTeams(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([ZEPHYR_TEAM, ACME_TEAM]);

		const byCreated = await resolver.organizationTeams(undefined, [{ field: 'createdAt', direction: 'DESC' }]);
		expect(byCreated.nodes.map((node) => node.id)).toEqual([ZEPHYR_TEAM, ACME_TEAM]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.organizationTeams(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ACME_TEAM]);

		const second = await resolver.organizationTeams(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ZEPHYR_TEAM]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.organizationTeams(undefined, undefined, undefined, 20);

		const last = await resolver.organizationTeams(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ACME_TEAM]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationTeams(undefined, [{ field: 'logo', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.organizationTeams(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OrganizationTeamResolver — one concept, two protocols, the same operations', () => {
	it('reads one team through the statistics query the REST route dispatches', async () => {
		const { resolver, queryBus, organizationTeamService } = surfaces();

		expect(await resolver.organizationTeam(ACME_TEAM)).toBe(ROWS[1]);

		const query = queryBus.execute.mock.calls[0][0] as GetOrganizationTeamStatisticQuery;
		expect(query).toBeInstanceOf(GetOrganizationTeamStatisticQuery);
		expect(query.organizationTeamId).toBe(ACME_TEAM);
		// The route's own defaults for a query string that states nothing: no date window, no relation
		// and no last-worked-task sync.
		expect(query.query).toEqual({});
		// The delivered route does not call the plain finder, so neither does this field.
		expect(organizationTeamService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('answers null for a team the delivered read reports as missing, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, queryBus } = surfaces();
		queryBus.execute.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.organizationTeam(ZEPHYR_TEAM)).toBeNull();
	});

	it('surfaces the refusal the delivered statistics read states rather than turning it into an empty answer', async () => {
		const { resolver, queryBus } = surfaces();
		const refusal = new BadRequestException('Failed to execute organization team statistic query');

		queryBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.organizationTeam(ZEPHYR_TEAM)).rejects.toBe(refusal);
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, organizationTeamService } = surfaces();

		expect(await resolver.organizationTeamCount()).toBe(2);
		expect(organizationTeamService.countBy).toHaveBeenCalledWith();
	});

	it('files a team through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationTeam({
			name: 'Platform',
			organizationId: ORGANIZATION,
			memberIds: [MEMBER],
			managerIds: [MANAGER],
			tagIds: [TAG],
			projectIds: [PROJECT]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationTeamCreateCommand);
		// The two relations are handed over as the rows the delivered write attaches, named by the one
		// member an identifier list can carry.
		expect(command.input).toEqual({
			name: 'Platform',
			organizationId: ORGANIZATION,
			memberIds: [MEMBER],
			managerIds: [MANAGER],
			tags: [{ id: TAG }],
			projects: [{ id: PROJECT }]
		});
		// The tenant is never a member of the payload: the write stamps it from the credential.
		expect(command.input).not.toHaveProperty('tenantId');
	});

	it('edits a team through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, organizationTeamService } = surfaces();

		await resolver.updateOrganizationTeam({
			id: ACME_TEAM,
			name: 'Acme',
			organizationId: ORGANIZATION,
			teamSize: '5',
			shareProfileView: false,
			tagIds: [TAG]
		});

		const [id, values] = organizationTeamService.update.mock.calls[0] as [string, Record<string, unknown>];
		expect(id).toBe(ACME_TEAM);
		// The delivered route carries the identifier in the path and the facts in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(values).not.toHaveProperty('id');
		expect(values).toEqual({
			name: 'Acme',
			organizationId: ORGANIZATION,
			teamSize: '5',
			shareProfileView: false,
			tags: [{ id: TAG }]
		});
	});

	it('removes a team through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamService } = surfaces();

		expect(await resolver.deleteOrganizationTeam(ACME_TEAM, { organizationId: ORGANIZATION })).toBe(true);
		expect(organizationTeamService.deleteTeam).toHaveBeenCalledWith(ACME_TEAM, { organizationId: ORGANIZATION });

		// The route's options are optional and the field states them as such: an unstated request
		// removes under the credential's own scope.
		expect(await resolver.deleteOrganizationTeam(ACME_TEAM)).toBe(true);
		expect(organizationTeamService.deleteTeam).toHaveBeenLastCalledWith(ACME_TEAM, {});
	});

	it('removes a user from the teams they joined through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamService } = surfaces();

		expect(await resolver.removeUserFromOrganizationTeams(MEMBER)).toBe(true);
		expect(organizationTeamService.existTeamsAsMember).toHaveBeenCalledWith(MEMBER);
	});

	it('withdraws and restores a team through the same service methods the REST routes call', async () => {
		const { resolver, organizationTeamService } = surfaces();

		const withdrawn = await resolver.softDeleteOrganizationTeam(ACME_TEAM);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(organizationTeamService.softRemove).toHaveBeenCalledWith(ACME_TEAM);

		expect(await resolver.recoverOrganizationTeam(ACME_TEAM)).toBe(ROWS[1]);
		expect(organizationTeamService.softRecover).toHaveBeenCalledWith(ACME_TEAM);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, organizationTeamService } = surfaces();
		const refusal = new Error('FORBIDDEN: the caller does not manage this team.');

		organizationTeamService.deleteTeam.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteOrganizationTeam(ACME_TEAM, { organizationId: ORGANIZATION })).rejects.toBe(
			refusal
		);
	});
});

describe('OrganizationTeamResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationTeamResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationTeamController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationTeamResolver) ?? [];
		const routes = [
			'findAll',
			'findMyTeams',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'existTeamsAsMember',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationTeamController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permissions the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamResolver)).toEqual(CLASS_PERMISSIONS);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationTeams', 'findAll'],
			['myOrganizationTeams', 'findMyTeams'],
			['organizationTeam', 'findById'],
			['organizationTeamCount', 'getCount'],
			['createOrganizationTeam', 'create'],
			['updateOrganizationTeam', 'update'],
			['deleteOrganizationTeam', 'delete'],
			['removeUserFromOrganizationTeams', 'existTeamsAsMember'],
			['softDeleteOrganizationTeam', 'softRemove'],
			['recoverOrganizationTeam', 'softRecover']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationTeamController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view pair on the reads and the class pair on the two lifecycle moves', () => {
		// The three read routes state the view pair on the handler, and the fields state the same pair
		// rather than the class's edit one — reading a team under a narrower grant than the route serves
		// is not a change this delivery may make.
		for (const field of ['organizationTeams', 'myOrganizationTeams', 'organizationTeam', 'organizationTeamCount']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW]);
		}

		// The withdrawal and the recovery are inherited from the CRUD base and declare no permission of
		// their own, so they run under the controller's class-level pair — and so do the fields, stated
		// rather than left to be inherited, so the parity is readable.
		for (const handler of ['softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(OrganizationTeamController)[handler])).toBeUndefined();
			expect(permissionOfRoute(OrganizationTeamController, handler)).toEqual(CLASS_PERMISSIONS);
		}
		expect(permissionOfField('softDeleteOrganizationTeam')).toEqual(CLASS_PERMISSIONS);
		expect(permissionOfField('recoverOrganizationTeam')).toEqual(CLASS_PERMISSIONS);

		// The removal of a user from the teams they joined states a pair of its own on the route, which
		// is the pair the field states.
		expect(permissionOfField('removeUserFromOrganizationTeams')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER
		]);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (OrganizationTeamResolver.prototype as never)[field],
		getClass: () => OrganizationTeamResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationTeamResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationTeamResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationTeamResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('organizationTeams')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('organizationTeams');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationTeams'))).resolves.toBe(true);
	});
});
