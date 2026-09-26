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
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard } from '../shared/guards';
import { ApiKeyAuthGuard } from '../shared/guards/api-key-auth.guard';
import { EmailCheckController } from './email-check.controller';
import { EmailCheckResolver } from './email-check.resolver';

/**
 * The email check over GraphQL.
 *
 * The delivered REST route answers one question: does an account with this address exist. This suite pins
 * the half of the two-protocol doctrine that is easy to get quietly wrong — and, because this is the one
 * resource in this delivery whose caller authenticates with a key pair rather than a session, the
 * decisions about guards:
 *
 * - the field reaches the same service method the REST route reaches, and answers the same member, so a
 *   client does not choose a better surface by choosing a protocol;
 * - **the API-key guard is carried**, because the controller carries it, and the public marker is stated,
 *   because the handler states it: a field with neither would refuse a caller the route serves;
 * - **no permission is stated**, because the controller states none — the key pair is what authorises the
 *   call;
 * - the answer carries the one member the delivered response carries and nothing about the account.
 */

const EMAIL = 'member@example.org';

/** The resolver, over a scripted service. */
function surfaces(exists = true) {
	const emailCheckService = {
		doesEmailExist: jest.fn().mockResolvedValue(exists)
	};

	return {
		emailCheckService,
		resolver: new EmailCheckResolver(emailCheckService as never)
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

/** The root fields this domain contributes. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('emailcheck'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmailCheckController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = EmailCheckResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = EmailCheckResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', EmailCheckResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmailCheckResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the check, and nothing else', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['emailCheck']));
		expect(ownedRootFields('Query')).toEqual(['emailCheck']);
		// The controller serves no list, no node route, no count and no write.
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares the answer with the one member the delivered response carries', () => {
		const body = typeBody('EmailCheckResult');

		expect(body).toMatch(/exists: Boolean!/);
		// The delivered read counts matching rows, so there is no account to describe — and a count is a
		// different disclosure from a truth.
		expect(body).not.toMatch(/\bcount\b/);
		expect(printed).toMatch(/emailCheck\([\s\S]*?email: String!\s*\): EmailCheckResult!/);
	});

	it('declares no list, no node, no count and no write, because the controller serves none', () => {
		expect(printed).not.toMatch(/emailChecks\(/);
		expect(printed).not.toMatch(/\bcheckedEmail\(/);
		expect(printed).not.toMatch(/emailCheckCount/);
		expect(printed).not.toMatch(/input \w*EmailCheck\w*Input/);
	});
});

describe('EmailCheckResolver — one concept, two protocols, the same operation', () => {
	it('checks through the same service method the REST route calls', async () => {
		const { resolver, emailCheckService } = surfaces(true);

		expect(await resolver.emailCheck(EMAIL)).toEqual({ exists: true });
		expect(emailCheckService.doesEmailExist).toHaveBeenCalledWith(EMAIL);
	});

	it('answers the same negative the REST route answers', async () => {
		const { resolver, emailCheckService } = surfaces(false);

		expect(await resolver.emailCheck(EMAIL)).toEqual({ exists: false });
		expect(emailCheckService.doesEmailExist).toHaveBeenCalledWith(EMAIL);
	});

	it('lets a failure reach the caller rather than answering a fabricated false', async () => {
		const { resolver, emailCheckService } = surfaces();
		const failure = new Error('connection terminated');

		emailCheckService.doesEmailExist.mockRejectedValueOnce(failure);

		await expect(resolver.emailCheck(EMAIL)).rejects.toBe(failure);
	});
});

describe('EmailCheckResolver — the guard stack is the controller’s', () => {
	it('carries the API-key guard the controller carries, and nothing the controller does not', () => {
		expect(Reflect.getMetadata('__guards__', EmailCheckController)).toEqual([ApiKeyAuthGuard]);
		expect(Reflect.getMetadata('__guards__', EmailCheckResolver)).toEqual([ApiKeyAuthGuard, FeatureFlagGuard]);
		expect(guardsOfField('emailCheck')).toEqual([ApiKeyAuthGuard, FeatureFlagGuard]);
	});

	it('states the openness the handler states, rather than leaving it implied', () => {
		// The handler is public, which is what exempts the delivered route from the application-wide
		// authentication guard: a machine caller presents a key pair and no session. A field without the
		// same marker would demand a credential the route does not.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, EmailCheckController)).toBeUndefined();
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(EmailCheckController)['checkEmail'])).toBe(true);
		expect(
			Reflect.getMetadata(
				PUBLIC_METHOD_METADATA,
				(EmailCheckResolver.prototype as unknown as Record<string, object>)['emailCheck']
			)
		).toBe(true);
	});

	it('states no permission, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmailCheckController)).toBeUndefined();
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmailCheckController)['checkEmail'])
		).toBeUndefined();
		expect(permissionOfField('emailCheck')).toBeUndefined();
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
		getHandler: () => (EmailCheckResolver.prototype as never)[field],
		getClass: () => EmailCheckResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmailCheckResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EmailCheckResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmailCheckResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('emailCheck')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('emailCheck');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('emailCheck'))).resolves.toBe(true);
	});
});
