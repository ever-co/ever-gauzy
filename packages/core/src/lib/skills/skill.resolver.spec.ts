/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { SkillController } from './skill.controller';
import { SkillResolver } from './skill.resolver';

/**
 * The skill over GraphQL.
 *
 * The delivered `/api/skills` routes serve a count, a page, a list, one skill, a filing, an edit, a
 * removal, the two lifecycle moves and a read by name. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field or a filter of one, and the list is a connection
 *   with the platform's own cursor codec behind it;
 * - every field reaches the same `SkillService` method the REST route reaches;
 * - **the guard chain is the controller's and no permission is stated anywhere**, because the
 *   controller states none — a permission here would refuse a caller the REST route serves;
 * - the name route is folded into the connection's `name` filter, and the one difference that folding
 *   leaves is asserted rather than glossed;
 * - a skill that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Carpentry',
		description: 'Joinery and framing',
		color: '#8B5CF6',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Bricklaying',
		description: null,
		color: '#F59E0B',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const skillService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { skillService, resolver: new SkillResolver(skillService as never) };
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

/** The printed body of one type, object or input. */
function body(name: string, kind: 'type' | 'input'): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof SkillController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof SkillController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof SkillController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = SkillResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The field-to-route correspondence this resource's parity claim is made of. */
const ROUTES: Array<[string, string]> = [
	['skills', 'findAll'],
	['skill', 'findById'],
	['skillCount', 'getCount'],
	['createSkill', 'create'],
	['updateSkill', 'update'],
	['deleteSkill', 'delete'],
	['softDeleteSkill', 'softRemove'],
	['recoverSkill', 'softRecover']
];

describe('SkillResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['skills', 'skill', 'skillCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createSkill', 'updateSkill', 'deleteSkill', 'softDeleteSkill', 'recoverSkill'])
		);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type SkillConnection \{\s*nodes: \[Skill!\]!\s*edges: \[SkillEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type SkillEdge \{\s*node: Skill!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input SkillFilter \{/);
		expect(printed).toMatch(/enum SkillSortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('carries the row’s own columns and neither pivot', () => {
		const skill = body('Skill', 'type');

		expect(skill).toMatch(/name: String!/);
		expect(skill).toMatch(/description: String\b/);
		expect(skill).toMatch(/color: String!/);
		expect(skill).toMatch(/deletedAt: DateTime/);
		// Both many-to-many pivots hold the foreign key: this row has no identifier for either, and the
		// delivered reads join neither.
		expect(skill).not.toContain('employees');
		expect(skill).not.toContain('organizations');
	});

	it('folds the delivered name route into the connection’s filter rather than doubling it', () => {
		// `GET /skills/getByName/:name` joins nothing the list read does not, so a root field of its own
		// would be a second surface that could disagree with this one.
		expect(rootFields('Query')).not.toContain('skillByName');
		expect(body('SkillFilter', 'input')).toMatch(/name: StringFilter/);
	});

	it('requires the two columns the store requires and offers no argument it cannot honour', () => {
		expect(body('CreateSkillInput', 'input')).toMatch(/name: String!/);
		// The column is `NOT NULL` with no default, so a skill cannot be filed without a colour.
		expect(body('CreateSkillInput', 'input')).toMatch(/color: String!/);
		expect(printed).not.toMatch(/skillCount\(/);
	});
});

describe('SkillResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, skillService } = surfaces();

		const connection = await resolver.skills(undefined, undefined, undefined, 20);

		expect(skillService.findAll).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders by the vocabulary’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		expect((await resolver.skills()).nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by name, which is the delivered name route’s own question', async () => {
		const { resolver } = surfaces();

		expect((await resolver.skills({ name: { eq: 'Carpentry' } })).nodes.map((node) => node.id)).toEqual([FIRST]);
		expect((await resolver.skills({ name: { eq: 'Nothing' } })).totalCount).toBe(0);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.skills(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);

		const second = await resolver.skills(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.skills(undefined, [{ field: 'color', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.skills({ employees: { eq: FIRST } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('SkillResolver — one concept, two protocols, the same operations', () => {
	it('reads one skill through the same service method the REST route calls', async () => {
		const { resolver, skillService } = surfaces();

		expect(await resolver.skill(FIRST)).toBe(ROWS[0]);
		expect(skillService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for a skill that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, skillService } = surfaces();
		skillService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.skill(SECOND)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, skillService } = surfaces();

		expect(await resolver.skillCount()).toBe(2);
		expect(skillService.countBy).toHaveBeenCalledWith();
	});

	it('files a skill through the same service method the REST route calls', async () => {
		const { resolver, skillService } = surfaces();

		await resolver.createSkill({ organizationId: ORGANIZATION, name: 'Carpentry', color: '#8B5CF6' });

		expect(skillService.create).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, name: 'Carpentry', color: '#8B5CF6' })
		);
	});

	it('changes a skill through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, skillService } = surfaces();

		const updated = await resolver.updateSkill({ id: FIRST, color: '#111827' });

		expect(skillService.update).toHaveBeenCalledWith(FIRST, { color: '#111827' });
		expect(skillService.findOneByIdString).toHaveBeenCalledWith(FIRST);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a skill through the same service method the REST route calls', async () => {
		const { resolver, skillService } = surfaces();

		expect(await resolver.deleteSkill(FIRST)).toBe(true);
		expect(skillService.delete).toHaveBeenCalledWith(FIRST);
	});

	it('withdraws and restores a skill through the same service methods the REST routes call', async () => {
		const { resolver, skillService } = surfaces();

		expect((await resolver.softDeleteSkill(FIRST)).deletedAt).toBeInstanceOf(Date);
		expect(skillService.softRemove).toHaveBeenCalledWith(FIRST);

		expect(await resolver.recoverSkill(FIRST)).toBe(ROWS[0]);
		expect(skillService.softRecover).toHaveBeenCalledWith(FIRST);
	});
});

describe('SkillResolver — the guard stack is the controller’s and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', SkillController)).toEqual(
			expect.arrayContaining([TenantPermissionGuard])
		);
		expect(Reflect.getMetadata('__guards__', SkillResolver)).toEqual(
			expect.arrayContaining([TenantPermissionGuard])
		);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', SkillResolver) ?? [];

		for (const [, handler] of ROUTES) {
			expect([...guardsOfRoute(SkillController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SkillController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SkillResolver)).toBeUndefined();
	});

	it('states no permission on any field, because no route has one to restate', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(SkillController, handler)])
		);

		// Every entry is `undefined`, on both sides: this resource is guarded and otherwise open, and a
		// permission invented here would refuse a caller the REST route serves.
		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((value) => value === undefined)).toBe(true);
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
		getHandler: () => (SkillResolver.prototype as never)[field],
		getClass: () => SkillResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('SkillResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, SkillResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', SkillResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('skills')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('skills');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('skills'))).resolves.toBe(true);
	});
});
