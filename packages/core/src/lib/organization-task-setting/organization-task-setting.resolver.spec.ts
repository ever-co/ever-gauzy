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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationTaskSettingController } from './organization-task-setting.controller';
import { OrganizationTaskSettingResolver } from './organization-task-setting.resolver';
import {
	OrganizationTaskSettingCreateCommand,
	OrganizationTaskSettingUpdateCommand
} from './commands';

/**
 * The organization task setting over GraphQL.
 *
 * The delivered REST routes serve a read of one organization's settings, a filing and an edit — and
 * nothing else, because the controller does not extend the CRUD base. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - those three capabilities are root fields of the one composed schema, and **only** those three: no
 *   connection, no count and no lifecycle mutation, because the REST surface serves none;
 * - every field calls the same service method, or dispatches the same command, that the REST route
 *   reaches;
 * - **the guard chain and the two-permission pairs are the controller's, field by field**;
 * - the members the delivered read can produce are what the object type carries, and the relations it
 *   does not join are identifiers rather than fields that would answer null.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SETTING = '00000000-0000-4000-8000-000000000010';

/** The row a scripted service answers with. */
const ROW = {
	id: SETTING,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	isTasksPrivacyEnabled: true,
	isTasksMultipleAssigneesEnabled: false,
	isTasksProofOfCompletionEnabled: true,
	tasksProofOfCompletionType: 'PRIVATE',
	tasksNotifyLeftPeriodDays: 7,
	tasksAutoClosePeriodDays: 7,
	tasksAutoArchivePeriodDays: 7,
	projectId: null,
	organizationTeamId: null,
	createdAt: new Date('2026-02-01T10:00:00.000Z'),
	updatedAt: new Date('2026-02-01T10:00:00.000Z')
};

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const organizationTaskSettingService = {
		findByOrganization: jest.fn().mockResolvedValue(ROW)
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROW) };

	return {
		organizationTaskSettingService,
		commandBus,
		resolver: new OrganizationTaskSettingResolver(
			organizationTaskSettingService as never,
			commandBus as never
		)
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
 * The concept's name begins with the organization's own, so the match is anchored at both ends rather
 * than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^organizationTaskSetting$/
			: /^(create|update)OrganizationTaskSetting$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The members one input type declares, read off the built schema rather than off the printed text.
 *
 * A description long enough to be wrapped is printed as a block string, so slicing the printed SDL
 * between braces is a parser this suite has no business owning. The schema's own type map answers the
 * question directly.
 */
function inputMembers(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** One input member's rendered type, so its nullability can be asserted as the schema states it. */
function inputMemberType(input: string, member: string): string {
	const type = schema.getType(input) as
		| { getFields(): Record<string, { readonly type: unknown }> }
		| undefined;

	return String(type?.getFields()?.[member]?.type);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OrganizationTaskSettingController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OrganizationTaskSettingController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OrganizationTaskSettingController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OrganizationTaskSettingResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('OrganizationTaskSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the read of one organization’s settings', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['organizationTaskSetting']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createOrganizationTaskSetting', 'updateOrganizationTaskSetting'])
		);
	});

	it('declares the read and the two writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['organizationTaskSetting']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOrganizationTaskSetting',
			'updateOrganizationTaskSetting'
		]);
	});

	it('declares no connection, no count and no lifecycle mutation, because the controller serves none', () => {
		// The controller does not extend the CRUD base: it serves three routes and no list, so a
		// connection here would be a capability the REST surface does not have.
		expect(rootFields('Query')).not.toEqual(
			expect.arrayContaining([
				'organizationTaskSettings',
				'organizationTaskSettingCount'
			])
		);
		expect(printed).not.toMatch(/type OrganizationTaskSettingConnection \{/);
		expect(printed).not.toMatch(/input OrganizationTaskSettingFilter \{/);
		expect(rootFields('Mutation')).not.toEqual(
			expect.arrayContaining([
				'deleteOrganizationTaskSetting',
				'softDeleteOrganizationTaskSetting',
				'recoverOrganizationTaskSetting'
			])
		);
	});

	it('requires the organization on the read, which is what the delivered route requires', () => {
		// The delivered handler refuses a request that names no organization with a `400`, so the
		// argument is required here rather than optional.
		expect(printed).toMatch(/organizationTaskSetting\(organizationId: ID!\): OrganizationTaskSetting/);
	});

	it('carries the settings the row decides and the identifiers of the relations it does not join', () => {
		const body = typeBody('OrganizationTaskSetting');

		expect(body).toMatch(/isTasksPrivacyEnabled: Boolean!/);
		expect(body).toMatch(/isTasksMultipleAssigneesEnabled: Boolean!/);
		expect(body).toMatch(/isTasksManualTimeEnabled: Boolean!/);
		expect(body).toMatch(/isTasksGroupEstimationEnabled: Boolean!/);
		expect(body).toMatch(/isTasksEstimationInHoursEnabled: Boolean!/);
		expect(body).toMatch(/isTasksEstimationInStoryPointsEnabled: Boolean!/);
		expect(body).toMatch(/isTasksProofOfCompletionEnabled: Boolean!/);
		expect(body).toMatch(/isTasksLinkedEnabled: Boolean!/);
		expect(body).toMatch(/isTasksCommentsEnabled: Boolean!/);
		expect(body).toMatch(/isTasksHistoryEnabled: Boolean!/);
		expect(body).toMatch(/isTasksAcceptanceCriteriaEnabled: Boolean!/);
		expect(body).toMatch(/isTasksDraftsEnabled: Boolean!/);
		expect(body).toMatch(/isTasksNotifyLeftEnabled: Boolean!/);
		expect(body).toMatch(/isTasksAutoCloseEnabled: Boolean!/);
		expect(body).toMatch(/isTasksAutoArchiveEnabled: Boolean!/);
		expect(body).toMatch(/isTasksAutoStatusEnabled: Boolean!/);
		expect(body).toMatch(/tasksNotifyLeftPeriodDays: Int!/);
		expect(body).toMatch(/tasksAutoClosePeriodDays: Int!/);
		expect(body).toMatch(/tasksAutoArchivePeriodDays: Int!/);
		// The vocabulary belongs to the shared constants, so the value is carried rather than an enum.
		expect(body).toMatch(/tasksProofOfCompletionType: String!/);
		// The two scoping relations are not joined by the delivered read, so the identifiers are what
		// is carried.
		expect(body).toMatch(/projectId: ID/);
		expect(body).toMatch(/organizationTeamId: ID/);
		expect(body).not.toMatch(/\bproject: OrganizationProject\b/);
		expect(body).not.toMatch(/\borganizationTeam:/);
	});

	it('declares the settings on both write inputs, and the identifier only on the edit', () => {
		const create = inputMembers('CreateOrganizationTaskSettingInput');
		const update = inputMembers('UpdateOrganizationTaskSettingInput');

		for (const member of ['isTasksPrivacyEnabled', 'tasksProofOfCompletionType', 'isTasksAutoStatusEnabled']) {
			expect(create).toContain(member);
			expect(update).toContain(member);
		}

		// The delivered edit body is the same body the create validates, plus the identifier the path
		// carries — and the organization stays required on both.
		expect(inputMemberType('CreateOrganizationTaskSettingInput', 'organizationId')).toBe('ID!');
		expect(inputMemberType('UpdateOrganizationTaskSettingInput', 'organizationId')).toBe('ID!');
		expect(create).not.toContain('id');
		expect(update).toContain('id');
		expect(inputMemberType('UpdateOrganizationTaskSettingInput', 'id')).toBe('ID!');
		// No member names the tenant: it is stamped from the credential on both writes.
		expect(create).not.toContain('tenantId');
		expect(update).not.toContain('tenantId');
	});
});

describe('OrganizationTaskSettingResolver — the read reaches the same service method the REST route calls', () => {
	it('reads through the same service method the REST route calls, with the same criterion', async () => {
		const { resolver, organizationTaskSettingService } = surfaces();

		expect(await resolver.organizationTaskSetting(ORGANIZATION)).toBe(ROW);
		// The route hands the service its query DTO, which carries the organization the caller named;
		// the tenant is applied to the criterion by the service, from the credential.
		expect(organizationTaskSettingService.findByOrganization).toHaveBeenCalledWith({
			organizationId: ORGANIZATION
		});
	});

	it('answers null when no row was ever filed for the organization', async () => {
		const { resolver, organizationTaskSettingService } = surfaces();
		// The delivered read logs and answers nothing when the lookup fails, which is the shape a
		// nullable field is for.
		organizationTaskSettingService.findByOrganization.mockResolvedValueOnce(undefined);

		expect(await resolver.organizationTaskSetting(ORGANIZATION)).toBeNull();
	});
});

describe('OrganizationTaskSettingResolver — one concept, two protocols, the same operations', () => {
	it('files the settings through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createOrganizationTaskSetting({
			organizationId: ORGANIZATION,
			isTasksPrivacyEnabled: true
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationTaskSettingCreateCommand);
		expect(command.input).toEqual({ organizationId: ORGANIZATION, isTasksPrivacyEnabled: true });
	});

	it('edits the settings through the command the REST route dispatches, with the identifier as the criterion', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateOrganizationTaskSetting({
			id: SETTING,
			organizationId: ORGANIZATION,
			tasksNotifyLeftPeriodDays: 3
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(OrganizationTaskSettingUpdateCommand);
		expect(command.id).toBe(SETTING);
		// The delivered route carries the identifier in the path and the settings in the body, so the
		// payload is the body and the identifier is not repeated inside it.
		expect(command.input).toEqual({ organizationId: ORGANIZATION, tasksNotifyLeftPeriodDays: 3 });
	});

	it('surfaces a refusal as the error the command raised', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('ORGANIZATION_TASK_SETTING_INVALID_SCOPE: the project is not in this organization.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createOrganizationTaskSetting({ organizationId: ORGANIZATION })
		).rejects.toBe(refusal);
	});
});

describe('OrganizationTaskSettingResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OrganizationTaskSettingResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OrganizationTaskSettingController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', OrganizationTaskSettingResolver) ?? [];

		for (const handler of ['findByOrganizationId', 'create', 'update']) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim.
			expect([...guardsOfRoute(OrganizationTaskSettingController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTaskSettingResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTaskSettingController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OrganizationTaskSettingResolver)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['organizationTaskSetting', 'findByOrganizationId'],
			['createOrganizationTaskSetting', 'create'],
			['updateOrganizationTaskSetting', 'update']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [
				field,
				permissionOfRoute(OrganizationTaskSettingController, handler)
			])
		);

		expect(stated).toEqual(expected);
	});

	it('states each pair of permissions the controller states, in the same order', () => {
		// The permission guard authorizes a caller holding *any* of the permissions a route states, so
		// dropping one of the pair here would narrow the field below the route it mirrors.
		expect(permissionOfField('organizationTaskSetting')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TASK_SETTING
		]);
		expect(permissionOfRoute(OrganizationTaskSettingController, 'findByOrganizationId')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TASK_SETTING
		]);

		for (const field of ['createOrganizationTaskSetting', 'updateOrganizationTaskSetting']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_EDIT,
				PermissionsEnum.ORG_TASK_SETTING
			]);
		}
		expect(permissionOfRoute(OrganizationTaskSettingController, 'create')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_SETTING
		]);
		expect(permissionOfRoute(OrganizationTaskSettingController, 'update')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_SETTING
		]);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
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
		getHandler: () => (OrganizationTaskSettingResolver.prototype as never)[field],
		getClass: () => OrganizationTaskSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OrganizationTaskSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OrganizationTaskSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OrganizationTaskSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('organizationTaskSetting'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('organizationTaskSetting');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('organizationTaskSetting'))).resolves.toBe(true);
	});
});
