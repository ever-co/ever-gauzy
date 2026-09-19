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
import { GoalGeneralSettingController } from './goal-general-setting.controller';
import { GoalGeneralSettingResolver } from './goal-general-setting.resolver';

/**
 * The organization's policy for the programme, over GraphQL.
 *
 * The delivered `/api/goal-general-setting` controller declares three routes and inherits six, and
 * this suite pins all nine as root fields of the one composed schema: the list as a connection behind
 * the platform's own cursor codec, every field reaching the same service method its route reaches —
 * the removal among them, which the controller declares nowhere and the CRUD base serves all the same
 * — the guard chain and the permission read from the controller's own metadata, and the gate
 * answering a switched-off capability the way a missing field is answered.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const HEAD_OFFICE = '00000000-0000-4000-8000-000000000002';
const LAB = '00000000-0000-4000-8000-000000000003';
const POLICY_HEAD = '00000000-0000-4000-8000-000000000060';
const POLICY_LAB = '00000000-0000-4000-8000-000000000061';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: POLICY_HEAD,
		tenantId: TENANT,
		organizationId: HEAD_OFFICE,
		maxObjectives: 12,
		maxKeyResults: 5,
		employeeCanCreateObjective: true,
		canOwnObjectives: 'ORGANIZATION',
		canOwnKeyResult: 'EMPLOYEE',
		krTypeKPI: true,
		krTypeTask: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: POLICY_LAB,
		tenantId: TENANT,
		organizationId: LAB,
		maxObjectives: 4,
		maxKeyResults: 3,
		employeeCanCreateObjective: false,
		canOwnObjectives: 'TEAM',
		canOwnKeyResult: 'TEAM',
		krTypeKPI: false,
		krTypeTask: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalGeneralSettingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		goalGeneralSettingService,
		resolver: new GoalGeneralSettingResolver(goalGeneralSettingService as never)
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

/** The composed schema, as text: every kernel and domain document the boot loader globs. */
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

/** The root fields this domain's own document declares, which is the "and no more" half of the pin. */
function declaredRootFields(file: string, operation: 'Query' | 'Mutation'): string[] {
	const sdl = readFileSync(join(__dirname, 'schema', file), 'utf8').replace(/"""[\s\S]*?"""/g, '');
	const block = sdl.match(new RegExp(`extend type ${operation} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';

	return [...block.matchAll(/^\t(\w+)\s*[(:\n]/gm)].map((match) => match[1]);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The permission one route runs under: what its handler states, else what its controller states —
 * the rule the guards themselves apply, restated over the controller's own metadata rather than over
 * a second copy of the same list.
 */
function permissionOfRoute(controller: typeof GoalGeneralSettingController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof GoalGeneralSettingController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalGeneralSettingResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goalGeneralSettings', 'findAll'],
	['goalGeneralSetting', 'findById'],
	['goalGeneralSettingCount', 'getCount'],
	['createGoalGeneralSetting', 'create'],
	['updateGoalGeneralSetting', 'update'],
	['deleteGoalGeneralSetting', 'delete'],
	['softDeleteGoalGeneralSetting', 'softRemove'],
	['recoverGoalGeneralSetting', 'softRecover']
];

describe('GoalGeneralSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['goalGeneralSettings', 'goalGeneralSetting', 'goalGeneralSettingCount'])
		);
	});

	it('declares one mutation per delivered write route, the inherited removal included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoalGeneralSetting',
				'updateGoalGeneralSetting',
				'deleteGoalGeneralSetting',
				'softDeleteGoalGeneralSetting',
				'recoverGoalGeneralSetting'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(declaredRootFields('goal-general-setting.api.gql', 'Query')).toEqual([
			'goalGeneralSettings',
			'goalGeneralSetting',
			'goalGeneralSettingCount'
		]);
		expect(declaredRootFields('goal-general-setting.api.gql', 'Mutation')).toEqual([
			'createGoalGeneralSetting',
			'updateGoalGeneralSetting',
			'deleteGoalGeneralSetting',
			'softDeleteGoalGeneralSetting',
			'recoverGoalGeneralSetting'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalGeneralSettingConnection \{\s*nodes: \[GoalGeneralSetting!\]!\s*edges: \[GoalGeneralSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalGeneralSettingEdge \{\s*node: GoalGeneralSetting!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalGeneralSettingFilter \{/);
		expect(printed).toMatch(/input GoalGeneralSettingSort \{/);
		expect(printed).toMatch(
			/enum GoalGeneralSettingSortField \{\s*createdAt\s*updatedAt\s*maxObjectives\s*maxKeyResults\s*\}/
		);
	});

	it('carries every policy member, because every column is non-nullable', () => {
		const body = typeBody('GoalGeneralSetting');

		expect(body).toMatch(/maxObjectives: Int!/);
		expect(body).toMatch(/maxKeyResults: Int!/);
		expect(body).toMatch(/employeeCanCreateObjective: Boolean!/);
		expect(body).toMatch(/canOwnObjectives: String!/);
		expect(body).toMatch(/canOwnKeyResult: String!/);
		expect(body).toMatch(/krTypeKPI: Boolean!/);
		expect(body).toMatch(/krTypeTask: Boolean!/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/goalGeneralSettings\([^)]*withDeleted/);
		expect(printed).not.toMatch(/goalGeneralSettingCount\(/);
	});
});

describe('GoalGeneralSettingResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		const connection = await resolver.goalGeneralSettings(undefined, undefined, undefined, 20);

		expect(goalGeneralSettingService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(POLICY_HEAD);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalGeneralSettings()).nodes.map((node) => node.id)).toEqual([
			POLICY_HEAD,
			POLICY_LAB
		]);
	});

	it('narrows by the fields the filter declares, the organization among them', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalGeneralSettings({ organizationId: { eq: LAB } })).nodes.map((node) => node.id)
		).toEqual([POLICY_LAB]);
		expect(
			(await resolver.goalGeneralSettings({ employeeCanCreateObjective: { eq: true } })).nodes.map(
				(node) => node.id
			)
		).toEqual([POLICY_HEAD]);
		expect((await resolver.goalGeneralSettings({ maxObjectives: { lte: 4 } })).totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalGeneralSettings(undefined, [{ field: 'maxObjectives', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([POLICY_LAB, POLICY_HEAD]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.goalGeneralSettings(undefined, undefined, undefined, 20);

		expect(
			(
				await resolver.goalGeneralSettings(undefined, undefined, {
					first: 1,
					after: all.edges[0].cursor
				})
			).nodes.map((node) => node.id)
		).toEqual([POLICY_LAB]);
		expect(
			(
				await resolver.goalGeneralSettings(undefined, undefined, {
					last: 1,
					before: all.edges[1].cursor
				})
			).nodes.map((node) => node.id)
		).toEqual([POLICY_HEAD]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalGeneralSettings(undefined, [{ field: 'organization', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goalGeneralSettings({ organization: { eq: LAB } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalGeneralSettings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalGeneralSettingResolver — one concept, two protocols, the same operations', () => {
	it('reads one policy through the same service method the REST route calls', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		expect(await resolver.goalGeneralSetting(POLICY_HEAD)).toBe(ROWS[0]);
		expect(goalGeneralSettingService.findOneByIdString).toHaveBeenCalledWith(POLICY_HEAD);
	});

	it('answers null for a policy that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();
		goalGeneralSettingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goalGeneralSetting(POLICY_LAB)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		expect(await resolver.goalGeneralSettingCount()).toBe(2);
		expect(goalGeneralSettingService.countBy).toHaveBeenCalledWith();
	});

	it('files a policy through the same service method the REST route calls', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		await resolver.createGoalGeneralSetting({
			maxObjectives: 12,
			maxKeyResults: 5,
			organizationId: HEAD_OFFICE
		});

		expect(goalGeneralSettingService.create).toHaveBeenCalledWith({
			maxObjectives: 12,
			maxKeyResults: 5,
			organizationId: HEAD_OFFICE
		});
	});

	it('changes a policy through the route’s update-through-create, identifier included', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		await resolver.updateGoalGeneralSetting({ id: POLICY_LAB, maxKeyResults: 6 });

		expect(goalGeneralSettingService.create).toHaveBeenCalledWith({ maxKeyResults: 6, id: POLICY_LAB });
	});

	it('removes a policy through the same service method the inherited route calls', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		expect(await resolver.deleteGoalGeneralSetting(POLICY_LAB)).toBe(true);
		expect(goalGeneralSettingService.delete).toHaveBeenCalledWith(POLICY_LAB);
	});

	it('withdraws and restores a policy through the same service methods the REST routes call', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();

		const withdrawn = await resolver.softDeleteGoalGeneralSetting(POLICY_HEAD);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalGeneralSettingService.softRemove).toHaveBeenCalledWith(POLICY_HEAD);

		expect(await resolver.recoverGoalGeneralSetting(POLICY_HEAD)).toBe(ROWS[0]);
		expect(goalGeneralSettingService.softRecover).toHaveBeenCalledWith(POLICY_HEAD);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalGeneralSettingService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalGeneralSettingService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteGoalGeneralSetting(POLICY_HEAD)).rejects.toBe(refusal);
	});
});

describe('GoalGeneralSettingResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', GoalGeneralSettingController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', GoalGeneralSettingResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalGeneralSettingResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(GoalGeneralSettingController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalGeneralSettingController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalGeneralSettingResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalGeneralSettingController, handler)])
		);

		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((value) => value === undefined)).toBe(true);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The gate, over a scripted cache and a scripted feature service. */
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
		getHandler: () => (GoalGeneralSettingResolver.prototype as never)[field],
		getClass: () => GoalGeneralSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalGeneralSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalGeneralSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalGeneralSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goalGeneralSettings')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('goalGeneralSettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goalGeneralSettings'))).resolves.toBe(true);
	});
});
