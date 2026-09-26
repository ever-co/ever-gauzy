/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureModule } from '../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpModule } from './custom-smtp.module';
import { CustomSmtpResolver } from './custom-smtp.resolver';
import { CustomSmtpCreateCommand, CustomSmtpUpdateCommand } from './commands';

/**
 * The SMTP configuration over GraphQL.
 *
 * The delivered resource is a CRUD controller with the resource's own resolving read and its transport
 * validator on top of the base it inherits, so this suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong on a resource of that shape:
 *
 * - every route the controller serves — the list, the node, the count, the resolved configuration, the
 *   creation, the edit, the removal, the two lifecycle moves and the validator — is a root field of the
 *   one composed schema, and the list is a connection with the platform's own cursor codec behind it;
 * - every field reaches the same service method, or dispatches the same command, that its own route
 *   reaches — the paginated spelling folds into the connection rather than becoming a second list;
 * - **the guard chain and the permission are the controller's**, read from its own metadata rather than
 *   restated here: this controller states no permission on any handler, so one class-level statement
 *   covers every route and every field;
 * - **the secret projection is asserted member by member**: the credentials are written and never
 *   answered, they are not filterable, and the installation-wide answer is one type rather than two;
 * - the whole surface is behind the capability the catalogue declares for GraphQL.
 */

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** Every root field this domain contributes, beside the delivered route it mirrors. */
const ROUTES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'customSmtpSettings', handler: 'findAll' },
	{ field: 'customSmtpSetting', handler: 'findById' },
	{ field: 'customSmtpSettingCount', handler: 'getCount' },
	{ field: 'smtpSetting', handler: 'getSmtpSetting' },
	{ field: 'validateSmtpSetting', handler: 'validateSmtpSetting' },
	{ field: 'createSmtpSetting', handler: 'create' },
	{ field: 'updateSmtpSetting', handler: 'update' },
	{ field: 'deleteSmtpSetting', handler: 'delete' },
	{ field: 'softDeleteSmtpSetting', handler: 'softRemove' },
	{ field: 'recoverSmtpSetting', handler: 'softRecover' }
];

/** The rows a scripted service answers with, in the order the connection returns them. */
const ROWS = [
	{
		id: '00000000-0000-4000-8000-000000000090',
		fromAddress: 'noreply@ever.co',
		host: 'smtp.postmarkapp.com',
		port: 587,
		secure: false,
		isValidate: true,
		organizationId: ORGANIZATION,
		tenantId: '00000000-0000-4000-8000-000000000001',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: '00000000-0000-4000-8000-000000000091',
		fromAddress: null,
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		isValidate: false,
		organizationId: null,
		tenantId: null,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The installation's own transport, as the resolving read answers it when there is no row at all. */
const DEFAULT_SETTING = { fromAddress: 'noreply@localhost', host: 'localhost', port: 587, secure: false };

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const customSmtpService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		getSmtpSetting: jest.fn().mockResolvedValue(ROWS[0]),
		verifyTransporter: jest.fn().mockResolvedValue(true),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return { customSmtpService, commandBus, resolver: new CustomSmtpResolver(customSmtpService as never, commandBus as never) };
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

/** The composed schema, as text: this domain's documents plus every kernel document the loader globs. */
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

const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/**
 * The root fields this domain contributes, stated exactly rather than by a prefix: two of them begin
 * with the concept's name and the resolving read does not, and a prefix would count a sibling's field
 * here.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) =>
			/^(customSmtpSettings|customSmtpSetting|customSmtpSettingCount|smtpSetting|createSmtpSetting|updateSmtpSetting|deleteSmtpSetting|softDeleteSmtpSetting|recoverSmtpSetting|validateSmtpSetting)$/.test(
				field
			)
		)
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** Whether one type declares a member, read from the declaration rather than from the text around it. */
function declaresMember(name: string, member: string): boolean {
	return new RegExp(`^\\s*${member}\\s*:`, 'm').test(typeBody(name));
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: object): Record<string, object> {
	return controller['prototype'] as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file. It is what makes the inherited
 * routes comparable: the count, the removal and the two lifecycle moves are the CRUD base's, so their
 * effective permission is their controller's class-level one.
 */
function permissionOfRoute(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CustomSmtpController)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CustomSmtpController)
	);
}

/** The guards one route actually runs under: the controller's chain followed by the handler's own. */
function guardsOfRoute(handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', CustomSmtpController) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(CustomSmtpController)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under, by the routes' own rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (CustomSmtpResolver.prototype as never)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CustomSmtpResolver)
	);
}

describe('CustomSmtpResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares every read the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'customSmtpSetting',
			'customSmtpSettingCount',
			'customSmtpSettings',
			'smtpSetting'
		]);
	});

	it('declares one mutation per delivered write route, the validator included', () => {
		expect(ownedRootFields('Mutation')).toEqual([
			'createSmtpSetting',
			'deleteSmtpSetting',
			'recoverSmtpSetting',
			'softDeleteSmtpSetting',
			'updateSmtpSetting',
			'validateSmtpSetting'
		]);
	});

	it('declares the connection, its edge, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type SmtpSettingConnection \{\s*nodes: \[SmtpSetting!\]!\s*edges: \[SmtpSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type SmtpSettingEdge \{\s*node: SmtpSetting!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input SmtpSettingFilter \{/);
		expect(printed).toMatch(/enum SmtpSettingSortField \{/);
	});

	it('carries the transport facts, and one type for both answers the resolving read gives', () => {
		for (const member of ['id', 'fromAddress', 'host', 'port', 'secure', 'isValidate', 'organizationId']) {
			expect(declaresMember('SmtpSetting', member)).toBe(true);
		}

		// A row has an identifier and the installation's own transport does not, which is how a caller
		// tells the two answers apart — one type rather than two, so a client reads a host name without
		// branching first.
		expect(typeBody('SmtpSetting')).toMatch(/id: ID\b/);
		expect(printed).not.toMatch(/type SmtpSettingRow/);
	});

	it('refuses the credentials, in cleartext and in their masked form', () => {
		// The row a resolver holds is the entity the masking ran on: its `username` and `password`
		// properties still carry what was stored, and only the serialized form is masked.
		expect(declaresMember('SmtpSetting', 'username')).toBe(false);
		expect(declaresMember('SmtpSetting', 'password')).toBe(false);
		// The masked copies are produced on the response path rather than held by the row.
		expect(declaresMember('SmtpSetting', 'secretKey')).toBe(false);
		expect(declaresMember('SmtpSetting', 'secretPassword')).toBe(false);
	});

	it('refuses to filter on a credential, which would read it one character at a time', () => {
		expect(declaresMember('SmtpSettingFilter', 'username')).toBe(false);
		expect(declaresMember('SmtpSettingFilter', 'password')).toBe(false);
		// The identifier of the installation-wide row is a filter a caller does state.
		expect(declaresMember('SmtpSettingFilter', 'organizationId')).toBe(true);
	});

	it('states the credentials on the way in, which is what the delivered bodies carry', () => {
		for (const input of ['CreateSmtpSettingInput', 'UpdateSmtpSettingInput', 'ValidateSmtpSettingInput']) {
			expect(declaresMember(input, 'username')).toBe(true);
			expect(declaresMember(input, 'password')).toBe(true);
		}
	});

	it('declares the validator as a mutation that answers a boolean', () => {
		expect(printed).toMatch(/validateSmtpSetting\(input: ValidateSmtpSettingInput!\): Boolean!/);
	});

	it('offers no argument it cannot honour', () => {
		// The count route passes its query string through as the store's own criterion, which this
		// surface cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/customSmtpSettingCount\(/);
	});
});

describe('CustomSmtpResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, customSmtpService } = surfaces();

		const connection = await resolver.customSmtpSettings(undefined, undefined, undefined, 20);

		expect(customSmtpService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ROWS[0].id);
	});

	it('orders the list newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.customSmtpSettings();

		expect(connection.nodes.map((node) => node.id)).toEqual([ROWS[0].id, ROWS[1].id]);
	});

	it('narrows by the fields the filter declares, the installation-wide row included', async () => {
		const { resolver } = surfaces();

		const mine = await resolver.customSmtpSettings({ organizationId: { eq: ORGANIZATION } });
		expect(mine.nodes.map((node) => node.id)).toEqual([ROWS[0].id]);

		const installationWide = await resolver.customSmtpSettings({ organizationId: { isNull: true } });
		expect(installationWide.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);

		const secure = await resolver.customSmtpSettings({ secure: { eq: true } });
		expect(secure.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.customSmtpSettings(undefined, undefined, undefined, 1);

		const second = await resolver.customSmtpSettings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([ROWS[1].id]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.customSmtpSettings(undefined, [{ field: 'fromAddress', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.customSmtpSettings({ password: { eq: 'x' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.customSmtpSettings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('CustomSmtpResolver — one concept, two protocols, the same operations', () => {
	it('reads one configuration through the same service method the node route calls', async () => {
		const { resolver, customSmtpService } = surfaces();

		expect(await resolver.customSmtpSetting(ROWS[0].id)).toBe(ROWS[0]);
		expect(customSmtpService.findOneByIdString).toHaveBeenCalledWith(ROWS[0].id);
	});

	it('answers null for a configuration that is not there, which is the route’s 404 in this vocabulary', async () => {
		const { resolver, customSmtpService } = surfaces();
		customSmtpService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.customSmtpSetting(ROWS[0].id)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, customSmtpService } = surfaces();

		expect(await resolver.customSmtpSettingCount()).toBe(2);
		expect(customSmtpService.countBy).toHaveBeenCalledWith();
	});

	it('resolves the configuration for an organization through the same service method its route calls', async () => {
		const { resolver, customSmtpService } = surfaces();

		expect(await resolver.smtpSetting(ORGANIZATION)).toBe(ROWS[0]);
		expect(customSmtpService.getSmtpSetting).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
	});

	it('answers the installation’s own transport when the organization has no configuration', async () => {
		const { resolver, customSmtpService } = surfaces();
		customSmtpService.getSmtpSetting.mockResolvedValueOnce(DEFAULT_SETTING);

		// The answer carries no identifier, which is how a caller tells it from a row.
		expect(await resolver.smtpSetting()).toEqual(DEFAULT_SETTING);
		expect(customSmtpService.getSmtpSetting).toHaveBeenCalledWith({ organizationId: undefined });
	});

	it('files a configuration through the command the creation route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			host: 'smtp.postmarkapp.com',
			port: 587,
			secure: false,
			username: 'account',
			password: 'secret'
		};

		await resolver.createSmtpSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CustomSmtpCreateCommand);
		expect(command.input).toEqual(input);
	});

	it('replaces a configuration through the command the edit route dispatches', async () => {
		const { resolver, commandBus } = surfaces();
		const input = {
			id: ROWS[0].id,
			host: 'smtp.gmail.com',
			port: 465,
			secure: true,
			username: 'account',
			password: 'secret'
		};

		await resolver.updateSmtpSetting(input);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(CustomSmtpUpdateCommand);
		// The delivered route takes the identifier from its path and the body from the payload, which is
		// the same split the command carries.
		expect(command.id).toBe(ROWS[0].id);
		expect(command.input).toEqual({
			host: 'smtp.gmail.com',
			port: 465,
			secure: true,
			username: 'account',
			password: 'secret'
		});
	});

	it('removes a configuration through the same service method the route calls', async () => {
		const { resolver, customSmtpService } = surfaces();

		expect(await resolver.deleteSmtpSetting(ROWS[0].id)).toBe(true);
		expect(customSmtpService.delete).toHaveBeenCalledWith(ROWS[0].id);
	});

	it('withdraws and restores a configuration through the same service methods the lifecycle routes call', async () => {
		const { resolver, customSmtpService } = surfaces();

		const withdrawn = await resolver.softDeleteSmtpSetting(ROWS[0].id);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(customSmtpService.softRemove).toHaveBeenCalledWith(ROWS[0].id);

		expect(await resolver.recoverSmtpSetting(ROWS[0].id)).toBe(ROWS[0]);
		expect(customSmtpService.softRecover).toHaveBeenCalledWith(ROWS[0].id);
	});

	it('validates a transport through the same service method the validator route calls', async () => {
		const { resolver, customSmtpService } = surfaces();
		const input = {
			host: 'smtp.postmarkapp.com',
			port: 587,
			secure: false,
			username: 'account',
			password: 'secret'
		};

		expect(await resolver.validateSmtpSetting(input)).toBe(true);
		expect(customSmtpService.verifyTransporter).toHaveBeenCalledWith(input);
	});

	it('reports a refused transport as false, which is what the delivered validator answers', async () => {
		const { resolver, customSmtpService } = surfaces();
		customSmtpService.verifyTransporter.mockResolvedValueOnce(false);

		expect(
			await resolver.validateSmtpSetting({
				host: 'smtp.postmarkapp.com',
				port: 587,
				secure: false,
				username: 'account',
				password: 'wrong'
			})
		).toBe(false);
	});

	it('surfaces a refusal rather than answering a row', async () => {
		const { resolver, customSmtpService } = surfaces();
		const refusal = new Error('SMTP_SETTING_REFUSED: the row belongs to another tenant.');

		customSmtpService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteSmtpSetting(ROWS[0].id)).rejects.toBe(refusal);
	});
});

describe('CustomSmtpResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		expect(Reflect.getMetadata('__guards__', CustomSmtpController) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);
		expect(Reflect.getMetadata('__guards__', CustomSmtpResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every field under the guard chain its own route runs under', () => {
		for (const { field, handler } of ROUTES) {
			const stated = Reflect.getMetadata('__guards__', CustomSmtpResolver) ?? [];

			expect([...guardsOfRoute(handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
			expect(Reflect.getMetadata('__guards__', (CustomSmtpResolver.prototype as never)[field])).toBeUndefined();
		}
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(ROUTES.map(({ field, handler }) => [field, permissionOfRoute(handler)]));

		expect(stated).toEqual(expected);
	});

	it('states the one permission the controller states, on the class and on every field', () => {
		// No handler on this controller states a permission of its own — the creation, the edit and the
		// validator included — so the class-level one is the whole of every route's scope.
		for (const { handler } of ROUTES) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(CustomSmtpController)[handler])).toBeUndefined();
			expect(permissionOfRoute(handler)).toEqual([PermissionsEnum.CUSTOM_SMTP_VIEW]);
		}

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CustomSmtpResolver)).toEqual([PermissionsEnum.CUSTOM_SMTP_VIEW]);

		for (const { field } of ROUTES) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.CUSTOM_SMTP_VIEW]);
		}
	});
});

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
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
		getHandler: () => (CustomSmtpResolver.prototype as never)[field],
		getClass: () => CustomSmtpResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('CustomSmtpResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, CustomSmtpResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', CustomSmtpResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('smtpSetting')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('smtpSetting');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the validator too, which is the field a caller would reach for first', async () => {
		await expect(gate(false).guard.canActivate(graphqlContext('validateSmtpSetting'))).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('customSmtpSettings'))).resolves.toBe(true);
	});
});

describe('CustomSmtpModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service and the commands', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, CustomSmtpModule) ?? []) as unknown[];
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, CustomSmtpModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(providers).toContain(CustomSmtpResolver);
		expect(resolved).toContain(FeatureModule);
	});
});
