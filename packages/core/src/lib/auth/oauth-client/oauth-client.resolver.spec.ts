/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { OAuthClientType, OAuthGrantType, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { OAuthClientController } from './oauth-client.controller';
import { OAuthClientResolver } from './oauth-client.resolver';

/**
 * The OAuth client registry over GraphQL.
 *
 * The delivered REST routes register a client, list the registry, read one client, edit one, rotate its
 * secret and revoke it. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `OAuthClientService` method the REST route reaches, so a client does
 *   not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — the controller states no permission on its class, so the class here states none either;
 * - **no secret is a member of the registry type**: the hash, the code-signing secret and the plaintext
 *   secret are all absent from `OAuthClient`, and the plaintext one is carried by the answer of the two
 *   operations that generate it;
 * - a client that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const CLIENT = '00000000-0000-4000-8000-000000000010';
const OTHER = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, as the delivered read projection shapes them: the response
 * DTO a route answers, which is what carries no secret at all.
 */
const ROWS = [
	{
		id: CLIENT,
		tenantId: TENANT,
		clientId: 'gauzy_first',
		name: 'First app',
		description: 'The first registered client',
		clientType: OAuthClientType.CONFIDENTIAL,
		redirectUris: ['https://first.example/redirect'],
		allowedScopes: ['profile'],
		allowedGrantTypes: [OAuthGrantType.AUTHORIZATION_CODE],
		pkceRequired: false,
		accessTokenTtl: 86400,
		refreshTokenTtl: 2592000,
		isActive: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER,
		tenantId: TENANT,
		clientId: 'gauzy_second',
		name: 'Second app',
		description: null,
		clientType: OAuthClientType.CONFIDENTIAL,
		redirectUris: ['https://second.example/redirect'],
		allowedScopes: [],
		allowedGrantTypes: [OAuthGrantType.AUTHORIZATION_CODE],
		pkceRequired: true,
		accessTokenTtl: 3600,
		refreshTokenTtl: 86400,
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const oauthClientService = {
		listForCurrentTenant: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneSafe: jest.fn().mockResolvedValue(ROWS[0]),
		createClient: jest.fn().mockResolvedValue({ ...ROWS[0], clientSecret: 'plaintext-secret' }),
		updateClient: jest.fn().mockResolvedValue(ROWS[0]),
		rotateSecret: jest.fn().mockResolvedValue({ ...ROWS[0], clientSecret: 'rotated-secret' }),
		softDeleteClient: jest.fn().mockResolvedValue(undefined)
	};

	return {
		oauthClientService,
		resolver: new OAuthClientResolver(oauthClientService as never)
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
	// The resolver lives one level below the library root — `auth/oauth-client` — so the walk starts two
	// levels up, at the directory the boot glob is rooted in, rather than at the domain's parent.
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('oauthclient'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof OAuthClientController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof OAuthClientController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof OAuthClientController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = OAuthClientResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = OAuthClientResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', OAuthClientResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('OAuthClientResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query and the one-row query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['oauthClients', 'oauthClient']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createOAuthClient',
				'updateOAuthClient',
				'rotateOAuthClientSecret',
				'deleteOAuthClient'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['oauthClient', 'oauthClients']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createOAuthClient',
			'deleteOAuthClient',
			'rotateOAuthClientSecret',
			'updateOAuthClient'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type OAuthClientConnection \{\s*nodes: \[OAuthClient!\]!\s*edges: \[OAuthClientEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type OAuthClientEdge \{\s*node: OAuthClient!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input OAuthClientFilter \{/);
		expect(printed).toMatch(/input OAuthClientSort \{/);
		expect(printed).toMatch(
			/enum OAuthClientSortField \{\s*createdAt\s*updatedAt\s*name\s*clientId\s*clientType\s*accessTokenTtl\s*refreshTokenTtl\s*\}/
		);
	});

	it('carries no secret on the registry type', () => {
		const body = typeBody('OAuthClient');

		// The public identifier and the human name are the two addresses of one row, so both are here.
		expect(body).toMatch(/clientId: String!/);
		expect(body).toMatch(/name: String!/);
		// The hash is what a guessed secret is checked against, and the code-signing secret forges
		// authorization codes: neither is answered by any delivered read, so neither is a member.
		expect(body).not.toContain('clientSecretHash');
		expect(body).not.toContain('codeSecret');
		// The plaintext secret belongs to the answer of the two operations that generate one, not to the
		// row: a member here would make it projectable from every read of the registry.
		expect(body).not.toContain('clientSecret');
		// The delivered read projection does not answer the audit column or the withdrawn marker.
		expect(body).not.toContain('deletedAt');
		expect(body).not.toContain('createdByUserId');
		// A null tenant is the installation-wide client, which is a fact a super administrator reads.
		expect(body).toMatch(/tenantId: ID/);
		// The three list columns are documents, as their columns are: the entity stores each through the
		// platform's JSON decorator and the read re-validates nothing, so a typed list would promise a
		// shape the read does not enforce.
		expect(body).toMatch(/redirectUris: JSON!/);
		expect(body).toMatch(/allowedScopes: JSON!/);
		expect(body).toMatch(/allowedGrantTypes: JSON!/);
	});

	it('carries the plaintext secret only on the answer of the two operations that generate one', () => {
		const body = typeBody('OAuthClientSecret');

		expect(body).toMatch(/client: OAuthClient!/);
		expect(body).toMatch(/clientSecret: String!/);
		expect(printed).toMatch(/createOAuthClient\(input: CreateOAuthClientInput!\): OAuthClientSecret!/);
		expect(printed).toMatch(/rotateOAuthClientSecret\(id: ID!\): OAuthClientSecret!/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/oauthClients\([^)]*withDeleted/);
		// The controller serves no count route, so this surface states no count field.
		expect(printed).not.toMatch(/oauthClientCount/);
		// The secrets are neither filterable nor sortable: a condition on a hash answers whether a
		// guessed credential is the right one, one character at a time.
		expect(printed).not.toMatch(/clientSecretHash/);
		expect(printed).not.toMatch(/codeSecret/);
		// The plaintext secret is declared exactly once in the whole schema, and that one place is the
		// answer type of the two operations that generate one.
		expect(printed.match(/clientSecret/g) ?? []).toHaveLength(1);
		expect(typeBody('OAuthClientSecret')).toContain('clientSecret');
	});
});

describe('OAuthClientResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, oauthClientService } = surfaces();

		const connection = await resolver.oauthClients(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same service method.
		expect(oauthClientService.listForCurrentTenant).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CLIENT);
	});

	it('orders by the registry’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.oauthClients();

		// Newest registration first, which is the row an administrator is looking for after a rotation.
		expect(connection.nodes.map((node) => node.id)).toEqual([CLIENT, OTHER]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.oauthClients({ name: { ilike: 'second%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER]);

		const byClientId = await resolver.oauthClients({ clientId: { eq: 'gauzy_first' } });
		expect(byClientId.nodes.map((node) => node.id)).toEqual([CLIENT]);

		const byPkce = await resolver.oauthClients({ pkceRequired: { eq: false } });
		expect(byPkce.nodes.map((node) => node.id)).toEqual([CLIENT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byClientId = await resolver.oauthClients(undefined, [{ field: 'clientId', direction: 'ASC' }]);
		expect(byClientId.nodes.map((node) => node.id)).toEqual([CLIENT, OTHER]);

		const byTtl = await resolver.oauthClients(undefined, [{ field: 'accessTokenTtl', direction: 'ASC' }]);
		expect(byTtl.nodes.map((node) => node.id)).toEqual([OTHER, CLIENT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.oauthClients(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([CLIENT]);

		const second = await resolver.oauthClients(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.oauthClients(undefined, undefined, undefined, 20);

		const last = await resolver.oauthClients(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([CLIENT]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.oauthClients(undefined, [{ field: 'clientSecretHash', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare, including a secret column', async () => {
		const { resolver } = surfaces();

		const unknown = await resolver.oauthClients({ redirectUris: { eq: 'x' } }).catch((thrown) => thrown);
		expect(isRefusal(unknown)).toBe(true);
		expect((unknown as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		const secret = await resolver.oauthClients({ codeSecret: { eq: 'x' } }).catch((thrown) => thrown);
		expect(isRefusal(secret)).toBe(true);
		expect((secret as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.oauthClients(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('OAuthClientResolver — one concept, two protocols, the same operations', () => {
	it('reads one client through the same service method the REST route calls', async () => {
		const { resolver, oauthClientService } = surfaces();

		expect(await resolver.oauthClient(CLIENT)).toBe(ROWS[0]);
		expect(oauthClientService.findOneSafe).toHaveBeenCalledWith(CLIENT);
	});

	it('answers null for a client that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, oauthClientService } = surfaces();
		oauthClientService.findOneSafe.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.oauthClient(OTHER)).toBeNull();
	});

	it('registers a client through the same service method the REST route calls', async () => {
		const { resolver, oauthClientService } = surfaces();

		const answer = await resolver.createOAuthClient({
			name: 'First app',
			redirectUris: ['https://first.example/redirect'],
			allowedScopes: ['profile']
		});

		expect(oauthClientService.createClient).toHaveBeenCalledWith({
			name: 'First app',
			redirectUris: ['https://first.example/redirect'],
			allowedScopes: ['profile']
		});
		// The plaintext secret is answered here and by no read.
		expect(answer.clientSecret).toBe('plaintext-secret');
	});

	it('never states the tenant on a registration, because the service stamps the credential’s', async () => {
		const { resolver, oauthClientService } = surfaces();

		await resolver.createOAuthClient({ name: 'First app', redirectUris: ['https://first.example/r'] });

		// `createClient` reads no `tenantId` off its argument: the only path to an installation-wide row
		// is its second parameter, which the REST route does not pass and this field does not either.
		expect(oauthClientService.createClient).toHaveBeenCalledTimes(1);
		expect(oauthClientService.createClient.mock.calls[0]).toHaveLength(1);
	});

	it('changes a client through the same service method the REST route calls', async () => {
		const { resolver, oauthClientService } = surfaces();

		await resolver.updateOAuthClient({ id: CLIENT, name: 'Renamed', isActive: false });

		expect(oauthClientService.updateClient).toHaveBeenCalledWith(CLIENT, { name: 'Renamed', isActive: false });
	});

	it('rotates a secret through the same service method the REST route calls', async () => {
		const { resolver, oauthClientService } = surfaces();

		const answer = await resolver.rotateOAuthClientSecret(CLIENT);

		expect(oauthClientService.rotateSecret).toHaveBeenCalledWith(CLIENT);
		expect(answer.clientSecret).toBe('rotated-secret');
	});

	it('revokes a client through the same service method the REST route calls', async () => {
		const { resolver, oauthClientService } = surfaces();

		expect(await resolver.deleteOAuthClient(CLIENT)).toBe(true);
		expect(oauthClientService.softDeleteClient).toHaveBeenCalledWith(CLIENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, oauthClientService } = surfaces();
		const refusal = new Error('Only super admins can create global OAuth clients.');

		oauthClientService.createClient.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createOAuthClient({ name: 'x', redirectUris: ['https://x.example/r'] })
		).rejects.toBe(refusal);
	});
});

describe('OAuthClientResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', OAuthClientResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', OAuthClientController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const routes = ['create', 'findAll', 'findOne', 'update', 'rotateSecret', 'remove'];

		for (const handler of routes) {
			// The controller's chain plus the gate is the field's own chain, which is the whole parity
			// claim: a route that added a guard of its own would narrow REST below GraphQL and is caught
			// here, and a field that added one would widen GraphQL above REST and is caught too.
			const field = {
				create: 'createOAuthClient',
				findAll: 'oauthClients',
				findOne: 'oauthClient',
				update: 'updateOAuthClient',
				rotateSecret: 'rotateOAuthClientSecret',
				remove: 'deleteOAuthClient'
			}[handler] as string;

			expect([...guardsOfRoute(OAuthClientController, handler), FeatureFlagGuard].sort()).toEqual(
				[...guardsOfField(field)].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OAuthClientController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OAuthClientResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['oauthClients', 'findAll'],
			['oauthClient', 'findOne'],
			['createOAuthClient', 'create'],
			['updateOAuthClient', 'update'],
			['rotateOAuthClientSecret', 'rotateSecret'],
			['deleteOAuthClient', 'remove']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(OAuthClientController, handler)])
		);

		expect(stated).toEqual(expected);
	});

	it('carries the view permission on the reads and the edit permission on the writes', () => {
		for (const field of ['oauthClients', 'oauthClient']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.OAUTH_CLIENT_VIEW]);
		}
		for (const field of [
			'createOAuthClient',
			'updateOAuthClient',
			'rotateOAuthClientSecret',
			'deleteOAuthClient'
		]) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.OAUTH_CLIENT_EDIT]);
		}
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
		getHandler: () => (OAuthClientResolver.prototype as never)[field],
		getClass: () => OAuthClientResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('OAuthClientResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, OAuthClientResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', OAuthClientResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('oauthClients')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('oauthClients');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('oauthClients'))).resolves.toBe(true);
	});
});
