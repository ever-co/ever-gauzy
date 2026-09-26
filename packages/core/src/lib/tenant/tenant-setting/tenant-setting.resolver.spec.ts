/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum, PREFERRED_UI_SETTING_KEY, PreferredUiEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureModule } from '../../feature/feature.module';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { TenantSettingModule } from './tenant-setting.module';
import { TenantSettingController } from './tenant-setting.controller';
import { TenantSettingResolver } from './tenant-setting.resolver';
import { TenantSettingService } from './tenant-setting.service';
import { TenantUiPreferencesController } from './tenant-ui-preferences.controller';
import {
	GlobalSettingGetCommand,
	GlobalSettingSaveCommand,
	TenantSettingGetCommand,
	TenantSettingSaveCommand
} from './commands';

/**
 * The tenant's configuration over GraphQL.
 *
 * The domain is served by two controllers, and the delivered routes between them serve the setting
 * rows, one row, a count, the settings document, its global sibling, the row edit, its removal, its
 * withdrawal and restoration, the Wasabi validator, and the tenant's UI flavour. This suite pins the
 * half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field calls the same service method, or dispatches the same command, that its own route
 *   calls — the settings-document reads and writes through the command bus, the row operations
 *   through the service, and the UI flavour through the resolution the delivered read performs;
 * - **the guard chain is both controllers' and the permission is each route's own**, read from the two
 *   controllers' metadata rather than restated — including the UI-preference read, whose route
 *   requires no permission at all, so a field that demanded one would refuse a caller REST serves;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are;
 * - a row that is not there is `null` on the one-row field rather than a refusal, and the scope
 *   columns are what tell a tenant-wide row from an organization's own.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT_WIDE_ROW = '00000000-0000-4000-8000-000000000010';
const ORGANIZATION_ROW = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted reader answers with, in the order the delivered list read returns them: a
 * tenant-wide row and an organization's own, which is the pair a reader has to be able to tell apart.
 */
const ROWS = [
	{
		id: TENANT_WIDE_ROW,
		name: 'fileStorageProvider',
		value: 'LOCAL',
		valueJson: null,
		valueType: 'STRING',
		isEncrypted: false,
		description: 'Where this tenant’s files are written.',
		organizationId: null,
		channelId: null,
		scope: 'TENANT',
		tenantId: TENANT,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: ORGANIZATION_ROW,
		name: 'preferredUi',
		value: 'react',
		valueJson: { preferredUi: 'react' },
		valueType: 'JSON',
		isEncrypted: false,
		description: null,
		organizationId: ORGANIZATION,
		channelId: null,
		scope: 'ORGANIZATION',
		tenantId: TENANT,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The document the delivered save commands answer with. */
const SAVED = { fileStorageProvider: 'LOCAL' };

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const tenantSettingService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0]),
		verifyWasabiConfiguration: jest.fn().mockResolvedValue({ status: 201, message: 'bucket created' }),
		getResolvedSettings: jest.fn().mockResolvedValue({ [PREFERRED_UI_SETTING_KEY]: PreferredUiEnum.REACT })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(SAVED) };

	return {
		tenantSettingService,
		commandBus,
		resolver: new TenantSettingResolver(tenantSettingService as never, commandBus as never)
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
 *
 * The walk starts at the library root rather than at this domain's parent: `tenant-setting` sits two
 * directories below `lib`, and a walk rooted at `tenant` would see this domain's two documents and
 * none of the kernel's — so the schema could not be built at all.
 */
function composedSchema(): string {
	const root = join(__dirname, '..', '..');
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

/** The field that mirrors the Wasabi validator, which carries no domain word in its name. */
const WASABI_FIELD = 'validateWasabiFileStorage';

/**
 * The root fields this domain contributes.
 *
 * The domain's fields are named for its two concepts — the settings and the UI preferences — and the
 * one that carries neither word is stated rather than derived, so a field added without a name of its
 * own is caught here instead of being silently ignored.
 *
 * @param operation The root operation type.
 * @returns The domain's root fields, sorted.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => {
			const name = field.toLowerCase();
			return name.includes('tenantsetting') || name.includes('tenantui') || field === WASABI_FIELD;
		})
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`(?:type|input|enum) ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * Whether one type declares a member.
 *
 * Read from the declaration rather than from the printed body as a whole, because the printed body
 * carries the descriptions too — and a description that explains *why* a member is absent names it,
 * which is exactly what a `not.toContain` assertion would trip over.
 *
 * @param name The type.
 * @param member The member.
 * @returns True when the member is declared.
 */
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
 * `[handler, class]` — restated here, so the resolver is held to the controllers' own metadata rather
 * than to a second copy of the same list written out in this file. It is what makes the inherited
 * routes comparable: the count, the row edit and the two lifecycle moves are the CRUD base's, so
 * their effective permission is their controller's class-level one.
 */
function permissionOfRoute(controller: object, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The permission one resolver field runs under, by the same rule. */
function permissionOfField(field: string): unknown {
	const fields = TenantSettingResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, TenantSettingResolver)
	);
}

/** Every root field and the delivered route it mirrors, on whichever of the two controllers serves it. */
const ROUTES: ReadonlyArray<{ field: string; controller: object; handler: string }> = [
	{ field: 'tenantSettings', controller: TenantSettingController, handler: 'pagination' },
	{ field: 'tenantSetting', controller: TenantSettingController, handler: 'findById' },
	{ field: 'tenantSettingCount', controller: TenantSettingController, handler: 'getCount' },
	{ field: 'tenantSettingValues', controller: TenantSettingController, handler: 'getSettings' },
	{ field: 'globalTenantSettingValues', controller: TenantSettingController, handler: 'getGlobalSettings' },
	{ field: 'updateTenantSetting', controller: TenantSettingController, handler: 'saveSettings' },
	{ field: 'updateDynamicTenantSetting', controller: TenantSettingController, handler: 'saveDynamicSettings' },
	{ field: 'saveGlobalTenantSetting', controller: TenantSettingController, handler: 'saveGlobalSettings' },
	{ field: 'updateTenantSettingRow', controller: TenantSettingController, handler: 'update' },
	{ field: 'deleteTenantSetting', controller: TenantSettingController, handler: 'delete' },
	{ field: 'softDeleteTenantSetting', controller: TenantSettingController, handler: 'softRemove' },
	{ field: 'recoverTenantSetting', controller: TenantSettingController, handler: 'softRecover' },
	{ field: 'validateWasabiFileStorage', controller: TenantSettingController, handler: 'validateWasabiConfiguration' },
	{ field: 'tenantUiPreferences', controller: TenantUiPreferencesController, handler: 'getUiPreferences' },
	{ field: 'updateTenantUiPreferences', controller: TenantUiPreferencesController, handler: 'updateUiPreferences' }
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };
	const guard = new FeatureFlagGuard(cache as never, new Reflector(), featureService as never);

	return { guard, featureService };
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (TenantSettingResolver.prototype as never)[field],
		getClass: () => TenantSettingResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TenantSettingResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the one-row query, the count and the two document reads', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'tenantSettings',
				'tenantSetting',
				'tenantSettingCount',
				'tenantSettingValues',
				'globalTenantSettingValues',
				'tenantUiPreferences'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'updateTenantSetting',
				'updateDynamicTenantSetting',
				'saveGlobalTenantSetting',
				'updateTenantSettingRow',
				'deleteTenantSetting',
				'softDeleteTenantSetting',
				'recoverTenantSetting',
				'validateWasabiFileStorage',
				'updateTenantUiPreferences'
			])
		);
	});

	it('declares the reads and the writes the controllers serve, and no more', () => {
		expect(ownedRootFields('Query')).toEqual([
			'globalTenantSettingValues',
			'tenantSetting',
			'tenantSettingCount',
			'tenantSettingValues',
			'tenantSettings',
			'tenantUiPreferences'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'deleteTenantSetting',
			'recoverTenantSetting',
			'saveGlobalTenantSetting',
			'softDeleteTenantSetting',
			'updateDynamicTenantSetting',
			'updateTenantSetting',
			'updateTenantSettingRow',
			'updateTenantUiPreferences',
			'validateWasabiFileStorage'
		]);
	});

	it('declares the connection, its edge, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type TenantSettingConnection \{\s*nodes: \[TenantSetting!\]!\s*edges: \[TenantSettingEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type TenantSettingEdge \{\s*node: TenantSetting!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input TenantSettingFilter \{/);
		expect(printed).toMatch(/input TenantSettingSort \{/);
		expect(printed).toMatch(
			/enum TenantSettingSortField \{\s*createdAt\s*updatedAt\s*name\s*scope\s*isEncrypted\s*\}/
		);
		expect(printed).toMatch(/enum TenantSettingScope \{\s*TENANT\s*ORGANIZATION\s*CHANNEL\s*\}/);
		expect(printed).toMatch(/input TenantSettingScopeFilter \{/);
	});

	it('carries the row as the REST surface returns it, scope columns and all', () => {
		expect(declaresMember('TenantSetting', 'name')).toBe(true);
		expect(declaresMember('TenantSetting', 'value')).toBe(true);
		expect(declaresMember('TenantSetting', 'valueType')).toBe(true);
		expect(declaresMember('TenantSetting', 'isEncrypted')).toBe(true);
		expect(declaresMember('TenantSetting', 'description')).toBe(true);
		// The three scope members and the scope itself: a reader cannot tell a tenant-wide row from an
		// organization's own without them.
		expect(declaresMember('TenantSetting', 'tenantId')).toBe(true);
		expect(declaresMember('TenantSetting', 'organizationId')).toBe(true);
		expect(declaresMember('TenantSetting', 'channelId')).toBe(true);
		expect(declaresMember('TenantSetting', 'scope')).toBe(true);
		// Withdrawing and restoring are delivered routes whose whole effect is this column.
		expect(declaresMember('TenantSetting', 'deletedAt')).toBe(true);
	});

	it('carries a structured value as a document rather than as a string of JSON', () => {
		expect(declaresMember('TenantSetting', 'valueJson')).toBe(true);
		expect(typeBody('TenantSetting')).toMatch(/valueJson: JSON/);
		// …and the filter compares it as a document too, because a string comparison would compare
		// against a form the column never stores.
		expect(typeBody('TenantSettingFilter')).toMatch(/valueJson: JSONFilter/);
	});

	it('declares the write inputs each delivered write binds', () => {
		expect(printed).toMatch(/input UpdateTenantSettingInput \{/);
		expect(printed).toMatch(/input UpdateDynamicTenantSettingInput \{/);
		expect(printed).toMatch(/input UpdateTenantSettingRowInput \{/);
		expect(printed).toMatch(/input WasabiFileStorageConfigInput \{/);
		expect(printed).toMatch(/input UpdateTenantUiPreferencesInput \{/);
		expect(printed).toMatch(/input TenantSettingValueInput \{/);
	});

	it('states the scope the caller chooses on the settings write, and not the tenant it stamps', () => {
		// The settings-document write names keys and values: the scope is the tenant of the credential.
		expect(declaresMember('UpdateTenantSettingInput', 'tenantId')).toBe(false);
		expect(declaresMember('UpdateTenantSettingInput', 'organizationId')).toBe(false);
		// The row edit writes the row itself, so it states the columns that address it.
		expect(declaresMember('UpdateTenantSettingRowInput', 'organizationId')).toBe(true);
		expect(declaresMember('UpdateTenantSettingRowInput', 'channelId')).toBe(true);
		expect(declaresMember('UpdateTenantSettingRowInput', 'scope')).toBe(true);
		// …and the identifier the delivered path carries, because its body can carry one as well.
		expect(declaresMember('UpdateTenantSettingRowInput', 'id')).toBe(true);
	});

	it('offers no argument it cannot honour', () => {
		// `withDeleted` is offered because the delivered list route offers it: `BaseQueryDTO` carries it
		// and that route hands its query string straight to the same read, so a REST caller can ask for
		// withdrawn rows and a connection that could not would hide them.
		expect(printed).toMatch(/tenantSettings\([^)]*withDeleted/);
		// The count route states no narrowing this surface could pass on, and a count is an aggregate a
		// resource may have no answer for — so the field is nullable and takes no argument.
		expect(printed).not.toMatch(/tenantSettingCount\(/);
		expect(printed).toMatch(/tenantSettingCount: Int\n/);
	});
});

describe('TenantSettingResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, tenantSettingService } = surfaces();

		const connection = await resolver.tenantSettings(undefined, undefined, undefined, 20);

		// The read is the set the delivered paginated list route slices.
		expect(tenantSettingService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ORGANIZATION_ROW);
	});

	it('orders the rows newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.tenantSettings();

		expect(connection.nodes.map((node) => node.id)).toEqual([ORGANIZATION_ROW, TENANT_WIDE_ROW]);
	});

	it('narrows by the scope columns, which is what tells one scope from another', async () => {
		const { resolver } = surfaces();

		const tenantWide = await resolver.tenantSettings({ organizationId: { isNull: true } });
		expect(tenantWide.nodes.map((node) => node.id)).toEqual([TENANT_WIDE_ROW]);

		const scoped = await resolver.tenantSettings({ organizationId: { eq: ORGANIZATION } });
		expect(scoped.nodes.map((node) => node.id)).toEqual([ORGANIZATION_ROW]);

		const byScope = await resolver.tenantSettings({ scope: { eq: 'TENANT' } });
		expect(byScope.nodes.map((node) => node.id)).toEqual([TENANT_WIDE_ROW]);

		const byName = await resolver.tenantSettings({ name: { ilike: 'preferred%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ORGANIZATION_ROW]);

		const byDocument = await resolver.tenantSettings({ valueJson: { isNull: false } });
		expect(byDocument.nodes.map((node) => node.id)).toEqual([ORGANIZATION_ROW]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.tenantSettings(undefined, [{ field: 'name', direction: 'ASC' }]);

		expect(byName.nodes.map((node) => node.id)).toEqual([TENANT_WIDE_ROW, ORGANIZATION_ROW]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.tenantSettings(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ORGANIZATION_ROW]);

		const second = await resolver.tenantSettings(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([TENANT_WIDE_ROW]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tenantSettings(undefined, [{ field: 'channelId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.tenantSettings({ unknownKnob: { eq: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tenantSettings(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('TenantSettingResolver — one concept, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST route calls', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.tenantSetting(TENANT_WIDE_ROW)).toBe(ROWS[0]);
		expect(tenantSettingService.findOneByIdString).toHaveBeenCalledWith(TENANT_WIDE_ROW);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, tenantSettingService } = surfaces();
		tenantSettingService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.tenantSetting(ORGANIZATION_ROW)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.tenantSettingCount()).toBe(2);
		expect(tenantSettingService.countBy).toHaveBeenCalledWith();
	});

	it('reads the settings document through the command the delivered read route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.tenantSettingValues()).toBe(SAVED);
		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(TenantSettingGetCommand);
	});

	it('reads the global document through the command the delivered global route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.globalTenantSettingValues()).toBe(SAVED);
		expect(commandBus.execute.mock.calls[0][0]).toBeInstanceOf(GlobalSettingGetCommand);
	});

	it('resolves the UI flavour through the same call its route makes, for the caller’s tenant', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.tenantUiPreferences()).toEqual({ preferredUi: PreferredUiEnum.REACT });
		expect(tenantSettingService.getResolvedSettings).toHaveBeenCalledWith([PREFERRED_UI_SETTING_KEY], null);
	});

	it('resolves an unusable stored flavour to the flavour that always exists', async () => {
		const { resolver, tenantSettingService } = surfaces();
		tenantSettingService.getResolvedSettings.mockResolvedValueOnce({ [PREFERRED_UI_SETTING_KEY]: 'svelte' });

		expect(await resolver.tenantUiPreferences()).toEqual({ preferredUi: PreferredUiEnum.ANGULAR });
	});

	it('saves the settings document through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateTenantSetting({ fileStorageProvider: 'LOCAL', aws_bucket: 'files' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TenantSettingSaveCommand);
		expect(command.input).toEqual({ fileStorageProvider: 'LOCAL', aws_bucket: 'files' });
	});

	it('folds the pairs a dynamic write states into the document the service reads', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateDynamicTenantSetting({
			settings: [
				{ name: 'posthogEnabled', value: 'true' },
				{ name: 'sentryDsn', value: 'https://example.test/1' }
			]
		});

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TenantSettingSaveCommand);
		expect(command.input).toEqual({ posthogEnabled: 'true', sentryDsn: 'https://example.test/1' });
	});

	it('saves the installation defaults through the global command, and not through the tenant one', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.saveGlobalTenantSetting({ settings: [{ name: 'posthogEnabled', value: 'false' }] });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(GlobalSettingSaveCommand);
		expect(command.input).toEqual({ posthogEnabled: 'false' });
	});

	it('replaces a row through the service method the REST route calls, and answers the row read back', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.updateTenantSettingRow({ id: TENANT_WIDE_ROW, scope: 'ORGANIZATION' })).toBe(ROWS[0]);
		expect(tenantSettingService.update).toHaveBeenCalledWith(
			TENANT_WIDE_ROW,
			expect.objectContaining({ id: TENANT_WIDE_ROW, scope: 'ORGANIZATION' })
		);
		expect(tenantSettingService.findOneByIdString).toHaveBeenCalledWith(TENANT_WIDE_ROW);
	});

	it('removes a row through the same service method the REST route calls', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.deleteTenantSetting(TENANT_WIDE_ROW)).toBe(true);
		expect(tenantSettingService.delete).toHaveBeenCalledWith(TENANT_WIDE_ROW);
	});

	it('withdraws and restores a row through the same service methods the REST routes call', async () => {
		const { resolver, tenantSettingService } = surfaces();

		const withdrawn = await resolver.softDeleteTenantSetting(TENANT_WIDE_ROW);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(tenantSettingService.softRemove).toHaveBeenCalledWith(TENANT_WIDE_ROW);

		expect(await resolver.recoverTenantSetting(TENANT_WIDE_ROW)).toBe(ROWS[0]);
		expect(tenantSettingService.softRecover).toHaveBeenCalledWith(TENANT_WIDE_ROW);
	});

	it('verifies a storage configuration through the same service method the validator route calls', async () => {
		const { resolver, tenantSettingService } = surfaces();

		expect(await resolver.validateWasabiFileStorage({ wasabi_aws_bucket: 'files' })).toEqual({
			status: 201,
			message: 'bucket created'
		});
		expect(tenantSettingService.verifyWasabiConfiguration).toHaveBeenCalledWith({ wasabi_aws_bucket: 'files' });
	});

	it('saves the UI flavour as a tenant setting, then answers the resolution the route answers with', async () => {
		const { resolver, commandBus, tenantSettingService } = surfaces();

		const preferences = await resolver.updateTenantUiPreferences({ preferredUi: PreferredUiEnum.REACT });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(TenantSettingSaveCommand);
		expect(command.input).toEqual({ [PREFERRED_UI_SETTING_KEY]: PreferredUiEnum.REACT });
		expect(tenantSettingService.getResolvedSettings).toHaveBeenCalledWith([PREFERRED_UI_SETTING_KEY], null);
		expect(preferences).toEqual({ preferredUi: PreferredUiEnum.REACT });
	});

	it('performs no write when the caller states no flavour, exactly as the delivered route does not', async () => {
		const { resolver, commandBus } = surfaces();

		const preferences = await resolver.updateTenantUiPreferences({});

		expect(commandBus.execute).not.toHaveBeenCalled();
		expect(preferences).toEqual({ preferredUi: PreferredUiEnum.REACT });
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, tenantSettingService } = surfaces();
		const refusal = new Error('Please include the required parameters as some are missing in your request.');

		tenantSettingService.verifyWasabiConfiguration.mockRejectedValueOnce(refusal);

		await expect(resolver.validateWasabiFileStorage({})).rejects.toBe(refusal);
	});
});

describe('TenantSettingResolver — the guard stack is both controllers’ and the permission is each route’s', () => {
	it('guards the resolver the way both controllers are guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', TenantSettingResolver) ?? [];
		const settingsGuards = Reflect.getMetadata('__guards__', TenantSettingController) ?? [];
		const preferencesGuards = Reflect.getMetadata('__guards__', TenantUiPreferencesController) ?? [];

		expect(settingsGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(preferencesGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('adds no guard of its own to any field, so every field runs under the controllers’ chain', () => {
		for (const { field } of ROUTES) {
			// The controllers declare their chain on the class and nothing on their handlers, so the
			// fields state nothing of their own either — the class chain is what runs.
			expect(
				Reflect.getMetadata('__guards__', (TenantSettingResolver.prototype as never)[field])
			).toBeUndefined();
		}
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(ROUTES.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(({ field, controller, handler }) => [field, permissionOfRoute(controller, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('states the global permission on the two global fields and the tenant permission on the rest', () => {
		expect(permissionOfField('globalTenantSettingValues')).toEqual([PermissionsEnum.GLOBAL_SETTING]);
		expect(permissionOfField('saveGlobalTenantSetting')).toEqual([PermissionsEnum.GLOBAL_SETTING]);

		for (const { field } of ROUTES) {
			if (field === 'globalTenantSettingValues' || field === 'saveGlobalTenantSetting') continue;
			if (field === 'tenantUiPreferences') continue;

			expect(permissionOfField(field)).toEqual([PermissionsEnum.TENANT_SETTING]);
		}
	});

	it('carries the class permission on no field’s behalf, because the two controllers disagree about it', () => {
		// `TenantSettingController` states `TENANT_SETTING` on the class; `TenantUiPreferencesController`
		// states none, because every signed-in user of the tenant reads the preference. One resolver
		// cannot state both, so the permission is stated per field — and the read of the preference is
		// the case that proves it: a class-level edit permission here would refuse a caller its route
		// serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TenantSettingResolver)).toBeUndefined();
		expect(permissionOfField('tenantUiPreferences')).toBeUndefined();
		expect(permissionOfRoute(TenantUiPreferencesController, 'getUiPreferences')).toBeUndefined();
		expect(permissionOfField('updateTenantUiPreferences')).toEqual([PermissionsEnum.TENANT_SETTING]);
	});

	it('states the tenant permission on the inherited routes’ fields, as their controller’s class does', () => {
		// The count, the row edit and the two lifecycle moves are the CRUD base’s: none of them states a
		// permission of its own, so the class-level one is the whole of their scope.
		for (const handler of ['getCount', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, (TenantSettingController.prototype as never)[handler])
			).toBeUndefined();
			expect(permissionOfRoute(TenantSettingController, handler)).toEqual([PermissionsEnum.TENANT_SETTING]);
		}
	});
});

describe('TenantSettingResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, TenantSettingResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TenantSettingResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('tenantSettings')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('tenantSettings');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the settings write itself while the capability is off', async () => {
		const { guard } = gate(false);

		// Nothing on this surface is exempt, the writes included: the door that switches the capability
		// back on is the REST route, which this code does not gate.
		await expect(guard.canActivate(graphqlContext('updateTenantSetting'))).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('tenantUiPreferences'))).resolves.toBe(true);
	});
});

describe('TenantSettingModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, TenantSettingModule) ?? []) as unknown[];

		expect(providers).toContain(TenantSettingResolver);
		expect(providers).toContain(TenantSettingService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, TenantSettingModule) ?? []) as unknown[];

		expect(exported).toContain(TenantSettingService);
		expect(exported).toContain(CqrsModule);
	});

	it('reaches the module that provides the feature service the gate resolves through', () => {
		// The gate is a guard, and a guard is a provider of whichever module declares the handler it
		// protects — so this module is what has to reach `FeatureService`, and the API boot fails on an
		// unresolved dependency without it. The reference is deferred, which is why it is resolved here
		// the way the container resolves it.
		const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, TenantSettingModule) ?? []) as Array<{
			forwardRef?: () => unknown;
		}>;
		const resolved = imports.map((entry) =>
			entry && typeof entry.forwardRef === 'function' ? entry.forwardRef() : entry
		);

		expect(resolved).toContain(FeatureModule);
	});
});
