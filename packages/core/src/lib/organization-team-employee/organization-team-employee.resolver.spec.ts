/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationTeamEmployeeController } from './organization-team-employee.controller';
import { OrganizationTeamEmployeeResolver } from './organization-team-employee.resolver';

/**
 * The organization team membership over GraphQL.
 *
 * The delivered REST routes serve exactly three operations — an edit, an edit of the task a member is
 * working on, and a removal — and this suite pins the half of the two-protocol doctrine that is easy
 * to get quietly wrong:
 *
 * - every one of those three capabilities is a root field of the one composed schema, and the surface
 *   declares no query field at all, because the controller is a plain controller with no list, no
 *   single row and no count: an empty query surface is asserted rather than assumed, since it is
 *   indistinguishable from a forgotten one by reading the resolver alone;
 * - every field reaches the same service method the REST route reaches, with the same arguments, so a
 *   client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permissions its own route runs
 *   under** — the three routes each declare their own pair, so nothing here is inferred from the class;
 * - the members the delivered write answers with are what the object type carries, and a relation the
 *   read does not join is an identifier rather than a member that would answer null;
 * - the two writes that answer with a row answer with the row the platform's own read produces, and
 *   the removal answers with the fact of it rather than with the count its envelope carries.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TEAM = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE = '00000000-0000-4000-8000-000000000004';
const MANAGER_ROLE = '00000000-0000-4000-8000-000000000005';
const MEMBER = '00000000-0000-4000-8000-000000000006';
const TASK = '00000000-0000-4000-8000-000000000007';
const NEXT_TASK = '00000000-0000-4000-8000-000000000008';
const USER = '00000000-0000-4000-8000-000000000009';

/**
 * The row a scripted service answers with, as the platform's own read of one membership produces it:
 * the columns of the row, with no relation joined.
 */
const ROW = {
	id: MEMBER,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	organizationTeamId: TEAM,
	employeeId: EMPLOYEE,
	roleId: MANAGER_ROLE,
	activeTaskId: TASK,
	order: 1,
	isTrackingEnabled: true,
	isManager: true,
	assignedAt: new Date('2026-02-01T10:00:00.000Z'),
	createdAt: new Date('2026-02-01T10:00:00.000Z'),
	updatedAt: new Date('2026-03-01T10:00:00.000Z'),
	createdByUserId: USER
};

/** The resolver, over a scripted service. */
function surfaces() {
	const organizationTeamEmployeeService = {
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		updateActiveTask: jest.fn().mockResolvedValue({ affected: 1 }),
		deleteTeamMember: jest.fn().mockResolvedValue({ affected: 1 }),
		findOneByIdString: jest.fn().mockResolvedValue(ROW)
	};

	return {
		organizationTeamEmployeeService,
		resolver: new OrganizationTeamEmployeeResolver(organizationTeamEmployeeService as never)
	};
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
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The match is a containment on the concept's own name rather than a prefix, because this domain's
 * fields carry the two words in the middle of a longer name and every one of them names the concept
 * (the edit of the active task included).
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('teamemployee'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationTeamEmployeeController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationTeamEmployeeController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationTeamEmployeeController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationTeamEmployeeResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationTeamEmployeeResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'updateOrganizationTeamEmployee',
				'updateOrganizationTeamEmployeeActiveTask',
				'deleteOrganizationTeamEmployee'
			])
		);
	});

	it('declares the three writes the controller serves, and no query field at all', () => {
		// The delivered controller is a plain controller: it serves no list, no single row and no
		// count, so a query field here would be a surface no route serves. The empty query surface is
		// asserted because it is the delivery's own statement, and an absent one is otherwise
		// indistinguishable from a forgotten one.
		expect(ownedRootFields('Query')).toEqual([]);
		expect(ownedRootFields('Mutation')).toEqual([
			'deleteOrganizationTeamEmployee',
			'updateOrganizationTeamEmployee',
			'updateOrganizationTeamEmployeeActiveTask'
		]);
	});

	it('declares each mutation with the path identifier and the payload its route carries', () => {
		// Every delivered route carries the identifier in its path and the facts in its body, so the
		// identifier is the field's own argument and is never repeated inside the payload.
		expect(printed).toMatch(
			/updateOrganizationTeamEmployee\(id: ID!, input: UpdateOrganizationTeamEmployeeInput!\): OrganizationTeamEmployee!/
		);
		expect(printed).toMatch(
			/updateOrganizationTeamEmployeeActiveTask\(id: ID!, input: OrganizationTeamEmployeeActiveTaskInput!\): OrganizationTeamEmployee!/
		);
		expect(printed).toMatch(
			/deleteOrganizationTeamEmployee\(id: ID!, options: OrganizationTeamEmployeeDeleteInput!\): Boolean!/
		);
	});

	it('declares the object type the three writes answer with, and the three inputs they take', () => {
		expect(printed).toMatch(/type OrganizationTeamEmployee \{/);
		expect(printed).toMatch(/input UpdateOrganizationTeamEmployeeInput \{/);
		expect(printed).toMatch(/input OrganizationTeamEmployeeActiveTaskInput \{/);
		expect(printed).toMatch(/input OrganizationTeamEmployeeDeleteInput \{/);
	});

	it('carries the columns the delivered read produces, and identifiers for the relations it does not join', () => {
		const body = typeBody('OrganizationTeamEmployee');

		expect(body).toMatch(/id: ID!/);
		expect(body).toMatch(/order: Int/);
		expect(body).toMatch(/isTrackingEnabled: Boolean/);
		expect(body).toMatch(/isManager: Boolean/);
		expect(body).toMatch(/assignedAt: DateTime/);
		// The delivered read joins no relation, so each of the four is carried as its identifier
		// column and the row it names is read from the surface that owns it.
		expect(body).toMatch(/activeTaskId: ID/);
		expect(body).toMatch(/organizationTeamId: ID!/);
		expect(body).toMatch(/employeeId: ID!/);
		expect(body).toMatch(/roleId: ID/);
		// A relation declared as a member would answer null on every row this surface can produce.
		for (const relation of ['activeTask', 'organizationTeam', 'employee', 'role']) {
			expect(body).not.toMatch(new RegExp(`\\b${relation}:`));
		}
		expect(body).toMatch(/tenantId: ID/);
		expect(body).toMatch(/organizationId: ID/);
	});

	it('carries the row’s own audit and lifecycle columns', () => {
		const body = typeBody('OrganizationTeamEmployee');

		expect(body).toMatch(/createdAt: DateTime/);
		expect(body).toMatch(/updatedAt: DateTime/);
		// The two labels of a write that reached this row: who put the member on the team and who last
		// changed the membership. The user rows are read from the user surface.
		expect(body).toMatch(/createdByUserId: ID/);
		expect(body).toMatch(/updatedByUserId: ID/);
		expect(body).toMatch(/isActive: Boolean/);
		expect(body).toMatch(/isArchived: Boolean/);
		expect(body).toMatch(/archivedAt: DateTime/);
	});

	it('leaves the withdrawal pair out, because the one removal this resource serves is a hard delete', () => {
		const body = typeBody('OrganizationTeamEmployee');

		// Nothing marks a membership: the removal route deletes the row, and the delivered read
		// excludes a withdrawn row in any case — so both members could only ever answer null.
		expect(body).not.toContain('deletedAt');
		expect(body).not.toContain('deletedByUserId');
	});

	it('carries no money member and no member that states a unit', () => {
		const body = typeBody('OrganizationTeamEmployee');

		// A membership records a roster position, two flags and a set of references. The fractional and
		// exact-decimal members of this platform belong to amounts and rates, which this row has none of.
		expect(body).not.toContain('Decimal');
		expect(body).not.toMatch(/\bFloat\b/);
		expect(body).toMatch(/order: Int/);
	});

	it('declares the edit members the delivered body keeps, and not the one its whitelist drops', () => {
		const body = inputBody('UpdateOrganizationTeamEmployeeInput');

		expect(body).toMatch(/organizationId: ID!/);
		expect(body).toMatch(/organizationTeamId: ID!/);
		expect(body).toMatch(/activeTaskId: ID/);
		expect(body).toMatch(/isTrackingEnabled: Boolean/);
		expect(body).toMatch(/order: Int/);
		// `isManager` is a member of the platform's own update input, and the delivered route's body
		// whitelist drops it because the edit DTO does not carry it: a write stating it would be
		// accepted and silently discarded.
		expect(body).not.toContain('isManager');
		// No member names the tenant: it is stamped from the credential on every write here, and the
		// delivered service reads the credential's tenant before it would read a stated one.
		expect(body).not.toContain('tenantId');
		// The identifier is the path segment, so it is the field's argument and not a payload member.
		expect(body).not.toMatch(/\bid: ID/);
	});

	it('declares the active-task edit and the removal from the members their routes actually read', () => {
		const activeTask = inputBody('OrganizationTeamEmployeeActiveTaskInput');
		const removal = inputBody('OrganizationTeamEmployeeDeleteInput');

		expect(activeTask).toMatch(/organizationId: ID!/);
		expect(activeTask).toMatch(/organizationTeamId: ID!/);
		expect(activeTask).toMatch(/activeTaskId: ID/);
		expect(activeTask).not.toContain('isTrackingEnabled');
		expect(activeTask).not.toContain('order');

		// The removal's scope is the query string the delivered route binds, stated under the names
		// that DTO declares — the organization and the team, and never the tenant.
		expect(removal).toMatch(/organizationId: ID!/);
		expect(removal).toMatch(/organizationTeamId: ID!/);
		expect(removal).not.toContain('tenantId');
		expect(removal).not.toContain('activeTaskId');
	});
});

describe('OrganizationTeamEmployeeResolver — one concept, two protocols, the same operations', () => {
	it('edits a membership through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();

		await resolver.updateOrganizationTeamEmployee(MEMBER, {
			organizationId: ORGANIZATION,
			organizationTeamId: TEAM,
			isTrackingEnabled: false,
			order: 3
		});

		expect(organizationTeamEmployeeService.update).toHaveBeenCalledWith(MEMBER, {
			organizationId: ORGANIZATION,
			organizationTeamId: TEAM,
			isTrackingEnabled: false,
			order: 3
		});
	});

	it('answers the edit with the row the platform’s own read produces', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();

		expect(
			await resolver.updateOrganizationTeamEmployee(MEMBER, {
				organizationId: ORGANIZATION,
				organizationTeamId: TEAM
			})
		).toBe(ROW);
		// The delivered route answers with the update envelope; the field answers the written row, read
		// through the same find-by-identifier the platform reads one row with.
		expect(organizationTeamEmployeeService.findOneByIdString).toHaveBeenCalledWith(MEMBER);
	});

	it('moves a member onto another task through the same service method the REST route calls', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();

		await resolver.updateOrganizationTeamEmployeeActiveTask(MEMBER, {
			organizationId: ORGANIZATION,
			organizationTeamId: TEAM,
			activeTaskId: NEXT_TASK
		});

		expect(organizationTeamEmployeeService.updateActiveTask).toHaveBeenCalledWith(MEMBER, {
			organizationId: ORGANIZATION,
			organizationTeamId: TEAM,
			activeTaskId: NEXT_TASK
		});
		expect(organizationTeamEmployeeService.findOneByIdString).toHaveBeenCalledWith(MEMBER);
	});

	it('answers the active-task edit with the row the platform’s own read produces, not with a projection of its own', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();
		const readBack = { ...ROW, activeTaskId: NEXT_TASK };

		organizationTeamEmployeeService.findOneByIdString.mockResolvedValueOnce(readBack);

		expect(
			await resolver.updateOrganizationTeamEmployeeActiveTask(MEMBER, {
				organizationId: ORGANIZATION,
				organizationTeamId: TEAM,
				activeTaskId: NEXT_TASK
			})
		).toBe(readBack);
	});

	it('answers a miss with the delivered read’s own not-found rather than an empty row', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();

		organizationTeamEmployeeService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		await expect(
			resolver.updateOrganizationTeamEmployee(MEMBER, {
				organizationId: ORGANIZATION,
				organizationTeamId: TEAM
			})
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it('removes a membership through the same service method the REST route calls, with the route’s own options', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();
		const options = { organizationId: ORGANIZATION, organizationTeamId: TEAM };

		expect(await resolver.deleteOrganizationTeamEmployee(MEMBER, options)).toBe(true);
		expect(organizationTeamEmployeeService.deleteTeamMember).toHaveBeenCalledWith(MEMBER, options);
	});

	it('surfaces the refusal the delivered service raises rather than a write that did not happen', async () => {
		const { resolver, organizationTeamEmployeeService } = surfaces();
		const refusal = new ForbiddenException('An error occurred while updating the organization team member.');

		organizationTeamEmployeeService.update.mockRejectedValueOnce(refusal);

		await expect(
			resolver.updateOrganizationTeamEmployee(MEMBER, {
				organizationId: ORGANIZATION,
				organizationTeamId: TEAM
			})
		).rejects.toBe(refusal);
	});
});

describe('OrganizationTeamEmployeeResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationTeamEmployeeResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationTeamEmployeeController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationTeamEmployeeResolver) ?? [];
		const routes = ['update', 'updateActiveTask', 'delete'];

		for (const handler of routes) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(OrganizationTeamEmployeeController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permissions the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamEmployeeResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamEmployeeController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTeamEmployeeResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_EDIT
		]);
	});

	it('states on every field the permissions its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['updateOrganizationTeamEmployee', 'update'],
			['updateOrganizationTeamEmployeeActiveTask', 'updateActiveTask'],
			['deleteOrganizationTeamEmployee', 'delete']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OrganizationTeamEmployeeController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('states the pair each route names, and never a permission the route does not carry', () => {
		// Every delivered route declares its own pair beside the handler, so none of these is inherited
		// from the class: the edit keeps the class pair, and the other two replace its second member with
		// the permission their own operation needs.
		expect(permissionOfRoute(OrganizationTeamEmployeeController, 'update')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_EDIT
		]);
		expect(permissionOfField('updateOrganizationTeamEmployee')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_EDIT
		]);

		expect(permissionOfRoute(OrganizationTeamEmployeeController, 'updateActiveTask')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK
		]);
		expect(permissionOfField('updateOrganizationTeamEmployeeActiveTask')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_EDIT_ACTIVE_TASK
		]);

		expect(permissionOfRoute(OrganizationTeamEmployeeController, 'delete')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_DELETE
		]);
		expect(permissionOfField('deleteOrganizationTeamEmployee')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TEAM_DELETE
		]);

		// The removal is not served under the edit permission, and the edit is not served under the
		// removal's: widening either one here would hand a caller a capability its route withholds.
		expect(permissionOfField('deleteOrganizationTeamEmployee')).not.toContain(PermissionsEnum.ORG_TEAM_EDIT);
		expect(permissionOfField('updateOrganizationTeamEmployee')).not.toContain(PermissionsEnum.ORG_TEAM_DELETE);
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
		getHandler: () => (OrganizationTeamEmployeeResolver.prototype as never)[field],
		getClass: () => OrganizationTeamEmployeeResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationTeamEmployeeResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationTeamEmployeeResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationTeamEmployeeResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('updateOrganizationTeamEmployee'))
			.catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('updateOrganizationTeamEmployee');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('deleteOrganizationTeamEmployee'))).resolves.toBe(true);
	});
});
