// cspell:ignore emailreset
/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmailResetController } from './email-reset.controller';
import { EmailResetModule } from './email-reset.module';
import { EmailResetResolver } from './email-reset.resolver';
import { EmailResetService } from './email-reset.service';

/**
 * The email reset over GraphQL.
 *
 * The delivered REST routes serve a request and its verification, both of them `POST`s, and nothing
 * else: this controller declares no list, no node and no count, and inherits none from a base it does
 * not extend. This suite pins the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - both delivered routes are root fields of the one composed schema, and the domain contributes no
 *   read — a field with no route behind it is the same defect as a route with no field, in the other
 *   direction;
 * - both fields call the same service method the REST route calls, with the same members, so a client
 *   does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission pair are the controller's**: the controller states both
 *   permissions on the class and none on either handler, so both fields state the pair rather than
 *   narrowing one of them to the grant that reads as the obvious fit;
 * - the acknowledgement the routes answer is the answer here too, and it says nothing about what was
 *   done — which is the whole of what the delivered handlers' `finally` exists to guarantee.
 */

const OUTCOME = { status: 200, message: 'OK' };
const ADDRESS = 'changed@example.test';

/** The resolver, over a scripted service. */
/** The requests a scripted read answers with, without their secrets. */
const VIEWS = [
	{
		id: 'reset-2',
		email: 'new@example.com',
		oldEmail: 'old@example.com',
		userId: 'user-1',
		tenantId: 'tenant-1',
		isExpired: false,
		createdAt: new Date('2026-09-02T10:00:00.000Z')
	},
	{
		id: 'reset-1',
		email: 'typo@example.com',
		oldEmail: 'old@example.com',
		userId: 'user-1',
		tenantId: 'tenant-1',
		isExpired: true,
		createdAt: new Date('2026-09-01T10:00:00.000Z')
	}
];

function surfaces() {
	const emailResetService = {
		requestChangeEmail: jest.fn().mockResolvedValue(OUTCOME),
		verifyCode: jest.fn().mockResolvedValue(OUTCOME),
		findForUser: jest.fn().mockResolvedValue(VIEWS)
	};

	return {
		emailResetService,
		resolver: new EmailResetResolver(emailResetService as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('emailreset'))
		.sort();
}

/** The printed body of one type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmailResetController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmailResetController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmailResetController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = EmailResetResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('EmailResetResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares one mutation per delivered route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['requestEmailReset', 'verifyEmailReset'])
		);
	});

	it('declares the two writes the controller serves, and no more', () => {
		expect(ownedRootFields('Mutation')).toEqual(['requestEmailReset', 'verifyEmailReset']);
	});

	it('declares the one read the controller serves, as a connection that never carries the secret', () => {
		// The list route is the only read: there is no node and no count route, so no field for either.
		expect(ownedRootFields('Query')).toEqual(['emailResets']);
		expect(printed).not.toMatch(/emailResetCount/);
		expect(printed).toMatch(/emailResets\([^)]*userId: ID[^)]*\): EmailResetConnection!/);
		// The code and the token are what a request is proved with; neither is a member, nor filterable.
		const body = typeBody('EmailReset');
		expect(body).toMatch(/email: String!/);
		expect(body).toMatch(/isExpired: Boolean!/);
		expect(body).not.toMatch(/^\s*(code|token)\s*:/m);
		expect(inputBody('EmailResetFilter')).not.toMatch(/^\s*(code|token)\s*:/m);
	});

	it('declares the acknowledgement both routes answer with', () => {
		const body = typeBody('EmailResetOutcome');

		expect(body).toMatch(/\bstatus: Int!/);
		expect(body).toMatch(/\bmessage: String!/);
		expect(printed).toMatch(/requestEmailReset\(input: RequestEmailResetInput!\): EmailResetOutcome!/);
		expect(printed).toMatch(/verifyEmailReset\(input: VerifyEmailResetInput!\): EmailResetOutcome!/);
	});

	it('declares the write inputs the mutations take, with the members the routes deliver', () => {
		// The subject of both routes is the credential's, so neither input names an account: the address is
		// the whole of what the request states and the code the whole of what the verification states.
		const request = inputBody('RequestEmailResetInput');
		expect(request).toMatch(/^\s*email: String!$/m);
		expect(request).not.toMatch(/^\s*code:/m);

		const verify = inputBody('VerifyEmailResetInput');
		expect(verify).toMatch(/^\s*code: String!$/m);
		expect(verify).not.toMatch(/^\s*email:/m);
	});
});

describe('EmailResetResolver — one concept, two protocols, the same operations', () => {
	it('requests a change through the same service method the REST route calls, in the caller’s language', async () => {
		const { resolver, emailResetService } = surfaces();

		expect(await resolver.requestEmailReset({ email: ADDRESS })).toEqual(OUTCOME);

		const [request, language] = emailResetService.requestChangeEmail.mock.calls[0];
		expect(request).toEqual({ email: ADDRESS });
		// The route reads the `language` request header; the field reads the same header off the same
		// request through the context, and both answer English when none was stated.
		expect(language).toBe(LanguagesEnum.ENGLISH);
	});

	it('verifies a change through the same service method the REST route calls', async () => {
		const { resolver, emailResetService } = surfaces();

		expect(await resolver.verifyEmailReset({ code: 'ABC123' })).toEqual(OUTCOME);
		// The code is the whole of the request: the account and the address it is being changed from are
		// read from the credential by the service, so a caller cannot present a code against another's.
		expect(emailResetService.verifyCode).toHaveBeenCalledWith({ code: 'ABC123' });
	});

	it('answers the acknowledgement the routes answer, and says nothing about what was done', async () => {
		const { resolver, emailResetService } = surfaces();

		// The delivered handlers answer in a `finally`, so the same answer is produced whether the address
		// was already taken, whether the mail went out, or whether the code matched. A field that turned
		// any of those into a different answer would tell a caller something REST does not.
		const taken = { status: 200, message: 'OK' };
		emailResetService.requestChangeEmail.mockResolvedValueOnce(taken);
		expect(await resolver.requestEmailReset({ email: ADDRESS })).toEqual(taken);

		const wrongCode = { status: 200, message: 'OK' };
		emailResetService.verifyCode.mockResolvedValueOnce(wrongCode);
		expect(await resolver.verifyEmailReset({ code: 'WRONG1' })).toEqual(wrongCode);

		// And an answer a caller must not be able to branch on carries no member beyond the pair.
		expect(Object.keys(OUTCOME).sort()).toEqual(['message', 'status']);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'requestEmailReset', route: 'requestChangeEmail' },
	{ field: 'verifyEmailReset', route: 'verifyChangeEmail' },
	{ field: 'emailResets', route: 'findAll' }
];

describe('EmailResetResolver — the requests, read without their secrets', () => {
	it('reads through the same service method the list route calls', async () => {
		const { resolver, emailResetService } = surfaces();

		const own = await resolver.emailResets();
		expect(emailResetService.findForUser).toHaveBeenCalledWith(undefined);
		expect(own.nodes.map((node) => node.id)).toEqual(['reset-2', 'reset-1']);

		const lapsed = await resolver.emailResets('user-1', { isExpired: { eq: true } });
		expect(emailResetService.findForUser).toHaveBeenLastCalledWith('user-1');
		expect(lapsed.nodes.map((node) => node.id)).toEqual(['reset-1']);

		const controller = new EmailResetController(emailResetService as never);
		expect(await controller.findAll({ userId: 'user-2' })).toBe(VIEWS);
		expect(emailResetService.findForUser).toHaveBeenLastCalledWith('user-2');
	});
});

describe('EmailResetService.findForUser — one user’s requests, never their code or token', () => {
	const TENANT = 'tenant-1';
	const CALLER = 'user-1';
	const OTHER = 'user-2';

	/** The service over a scripted tenant-scoped read that returns the secrets anyway. */
	function service() {
		const instance = Object.create(EmailResetService.prototype) as EmailResetService;
		const find = jest.fn().mockResolvedValue([
			{
				id: 'reset-1',
				email: 'new@example.com',
				oldEmail: 'old@example.com',
				userId: CALLER,
				tenantId: TENANT,
				code: '123456',
				token: 'jwt.secret.token',
				expiredAt: new Date(Date.now() - 60_000),
				createdAt: new Date('2026-09-01T10:00:00.000Z')
			}
		]);
		Object.assign(instance, { find });

		return { instance, find };
	}

	afterEach(() => jest.restoreAllMocks());

	it('reads the caller’s own requests by default, selecting neither the code nor the token', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(CALLER);
		const { instance, find } = service();

		const [view] = await instance.findForUser();

		const options = find.mock.calls[0][0];
		expect(options.where).toEqual({ tenantId: TENANT, userId: CALLER });
		expect(options.select.code).toBeUndefined();
		expect(options.select.token).toBeUndefined();
		// Even a read that returned them could not pass them on: the view is built member by member.
		expect(view).not.toHaveProperty('code');
		expect(view).not.toHaveProperty('token');
		expect(view.isExpired).toBe(true);
	});

	it('reads another user’s requests only for a caller who may edit users', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(CALLER);
		const permission = jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		const { instance, find } = service();

		await expect(instance.findForUser(OTHER)).rejects.toBeInstanceOf(ForbiddenException);
		expect(find).not.toHaveBeenCalled();

		permission.mockReturnValue(true);
		await instance.findForUser(OTHER);
		expect(find.mock.calls[0][0].where).toEqual({ tenantId: TENANT, userId: OTHER });
	});

	it('refuses a request that carries no user or no tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(CALLER);
		const { instance, find } = service();

		await expect(instance.findForUser()).rejects.toBeInstanceOf(UnauthorizedException);
		expect(find).not.toHaveBeenCalled();
	});
});

describe('EmailResetResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmailResetResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmailResetController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmailResetResolver) ?? [];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow REST
			// below GraphQL and is caught here.
			expect([...guardsOfRoute(EmailResetController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states on the class the permission pair the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailResetResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmailResetController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailResetController)).toEqual([
			PermissionsEnum.ORG_USERS_EDIT,
			PermissionsEnum.PROFILE_EDIT
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const stated = Object.fromEntries(PERMISSION_PARITY.map(({ field }) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			PERMISSION_PARITY.map(({ field, route }) => [field, permissionOfRoute(EmailResetController, route)])
		);

		expect(stated).toEqual(expected);
	});

	it('keeps the pair whole on both fields rather than narrowing each to one of the two grants', () => {
		// Neither handler states a permission of its own, so both routes run under both permissions and the
		// guard asks the same question on either protocol. A field stating only the grant that reads as the
		// obvious fit for it would be narrower than the route it mirrors.
		for (const { route } of PERMISSION_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmailResetController)[route])).toBeUndefined();
		}

		for (const { field } of PERMISSION_PARITY) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ORG_USERS_EDIT,
				PermissionsEnum.PROFILE_EDIT
			]);
		}
	});
});

describe('EmailResetModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmailResetModule) ?? []) as unknown[];

		expect(providers).toContain(EmailResetResolver);
		expect(providers).toContain(EmailResetService);
	});

	it('exports the service the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else. The resolver injects the
		// service and nothing beside it: the buses both fields' methods dispatch through are this module's
		// own.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmailResetModule) ?? []) as unknown[];

		expect(exported).toContain(EmailResetService);
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
		getHandler: () => (EmailResetResolver.prototype as never)[field],
		getClass: () => EmailResetResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmailResetResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmailResetResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmailResetResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('requestEmailReset')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('requestEmailReset');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('requestEmailReset'))).resolves.toBe(true);
	});
});
