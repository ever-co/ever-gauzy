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
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailResolver } from './estimate-email.resolver';

/**
 * The estimate email over GraphQL.
 *
 * The delivered REST route answers one question: does this token name a valid invitation, and what does
 * its page render. This suite pins the half of the two-protocol doctrine that is easy to get quietly
 * wrong — and, because this is the one resource in this delivery whose caller holds no credential, the
 * decision about guards and about the gate:
 *
 * - the field reaches the same service method the REST route reaches, with the same criterion and the
 *   same relations, so a client does not choose a better surface by choosing a protocol;
 * - **no guard and no permission are stated**, because the delivered route is `@Public()` and names
 *   neither: a guard here would refuse a caller REST serves;
 * - **the token is not a member**, because it is the credential the read is validated by and the
 *   delivered projection answers the row it verified rather than the value it verified it with;
 * - a refusal stays a refusal: a token that does not verify is not an invitation with no data;
 * - the gate is stated on the class, which is the platform rule every resolver is held to — and the
 *   consequence for a caller with no scope is asserted here rather than left to be discovered.
 */

const EMAIL = 'recipient@example.org';
const TOKEN = 'header.payload.signature';
const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ROW_ID = '00000000-0000-4000-8000-000000000010';

/** The row a scripted reader answers with, as the delivered read projects it. */
const ROW = {
	id: ROW_ID,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	email: EMAIL,
	expireDate: new Date('2026-06-01T10:00:00.000Z'),
	convertAcceptedEstimates: true,
	createdAt: new Date('2026-05-25T10:00:00.000Z'),
	updatedAt: new Date('2026-05-25T10:00:00.000Z')
};

/** The resolver, over a scripted service. */
function surfaces() {
	const estimateEmailService = {
		validate: jest.fn().mockResolvedValue(ROW)
	};

	return {
		estimateEmailService,
		resolver: new EstimateEmailResolver(estimateEmailService as never)
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
		.filter((field) => field.toLowerCase().includes('estimateemail'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EstimateEmailController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = EstimateEmailResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field runs under: the class's chain plus whatever the field restates. */
function guardsOfField(field: string): unknown[] {
	const fields = EstimateEmailResolver.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', EstimateEmailResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fields[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EstimateEmailResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the validation read, and nothing else', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['estimateEmailValidation']));
		expect(ownedRootFields('Query')).toEqual(['estimateEmailValidation']);
		// The controller serves no write, no list, no node route and no count.
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares no list, no node, no count and no write, because the controller serves none', () => {
		expect(printed).not.toMatch(/estimateEmails\(/);
		expect(printed).not.toMatch(/\bestimateEmail\(/);
		expect(printed).not.toMatch(/estimateEmailCount/);
		expect(printed).not.toMatch(/input (Create|Update)EstimateEmailInput/);
	});

	it('carries the projected row, and withholds the token the read is validated by', () => {
		const body = typeBody('EstimateEmail');

		expect(body).toMatch(/email: String!/);
		expect(body).toMatch(/expireDate: DateTime!/);
		expect(body).toMatch(/convertAcceptedEstimates: Boolean/);
		// The token is a bearer credential: presenting it is what proves the caller is the recipient, so
		// it is never a projectable member of the record it authenticates.
		expect(body).not.toMatch(/\btoken: String/);
		// No delivered route withdraws an estimate email, so the marker is null wherever it could be read.
		expect(body).not.toContain('deletedAt');
	});

	it('references the tenant and organization types rather than restating any part of them', () => {
		const body = typeBody('EstimateEmail');

		expect(body).toMatch(/tenant: Tenant/);
		expect(body).toMatch(/organization: Organization/);
		// They are declared by their own domains: this file references them and declares nothing of them.
		const own = readFileSync(join(__dirname, 'schema', 'estimate-email.type.gql'), 'utf8');
		expect(own).not.toMatch(/^type (Tenant|Organization) /m);
	});

	it('states the two relations the delivered query accepts, and no others', () => {
		expect(printed).toMatch(/enum EstimateEmailRelation \{[\s\S]*?\btenant\b[\s\S]*?\borganization\b[\s\S]*?\n\}/);
		expect(printed).toMatch(
			/estimateEmailValidation\([\s\S]*?relations: \[EstimateEmailRelation!\]\s*\): EstimateEmail!/
		);
	});
});

describe('EstimateEmailResolver — one concept, two protocols, the same operation', () => {
	it('validates through the same service method the REST route calls', async () => {
		const { resolver, estimateEmailService } = surfaces();

		expect(await resolver.estimateEmailValidation(EMAIL, TOKEN)).toBe(ROW);
		expect(estimateEmailService.validate).toHaveBeenCalledWith({ email: EMAIL, token: TOKEN }, []);
	});

	it('passes the relations the caller states, which is the delivered query member', async () => {
		const { resolver, estimateEmailService } = surfaces();

		await resolver.estimateEmailValidation(EMAIL, TOKEN, ['tenant', 'organization']);

		expect(estimateEmailService.validate).toHaveBeenCalledWith({ email: EMAIL, token: TOKEN }, [
			'tenant',
			'organization'
		]);
	});

	it('leaves the token’s verification to the service, and states no criterion of its own', async () => {
		const { resolver, estimateEmailService } = surfaces();

		await resolver.estimateEmailValidation(EMAIL, TOKEN);

		// The two members the delivered route binds, and nothing else: the tenant, the organization and
		// the token's own claims are read out of the verified token rather than stated by a caller.
		const criterion = estimateEmailService.validate.mock.calls[0][0];
		expect(Object.keys(criterion).sort()).toEqual(['email', 'token']);
	});

	it('lets a refusal reach the caller rather than answering a null row', async () => {
		const { resolver, estimateEmailService } = surfaces();
		const refusal = new Error('Bad Request: the token could not be verified');

		estimateEmailService.validate.mockRejectedValueOnce(refusal);

		await expect(resolver.estimateEmailValidation(EMAIL, 'forged')).rejects.toBe(refusal);
	});
});

describe('EstimateEmailResolver — the guard stack is the controller’s, which is to say open', () => {
	it('states no guard the controller does not state, and no permission at all', () => {
		// The delivered controller is `@Public()`: no guard on its class, none on its handler, and no
		// permission anywhere. A tenant or permission guard here would refuse a caller REST serves.
		expect(Reflect.getMetadata('__guards__', EstimateEmailController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EstimateEmailController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EstimateEmailController)['validateEstimateEmail'])).toBeUndefined();
		expect(permissionOfField('estimateEmailValidation')).toBeUndefined();
		// The one guard the resolver carries is the platform's gate, which every resolver carries.
		expect(Reflect.getMetadata('__guards__', EstimateEmailResolver)).toEqual([FeatureFlagGuard]);
		expect(guardsOfField('estimateEmailValidation')).toEqual([FeatureFlagGuard]);
	});

	it('states the openness its own route states, rather than leaving it implied', () => {
		// The controller marks itself public; the field states the same marker, which is what exempts both
		// from the authentication guard the bootstrap registers for the whole application. Without it the
		// field would demand a credential the delivered route does not.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, EstimateEmailController)).toBe(true);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlersOf(EstimateEmailController)['validateEstimateEmail'])).toBeUndefined();
		expect(
			Reflect.getMetadata(PUBLIC_METHOD_METADATA, (EstimateEmailResolver.prototype as unknown as Record<string, object>)['estimateEmailValidation'])
		).toBe(true);
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
		getHandler: () => (EstimateEmailResolver.prototype as never)[field],
		getClass: () => EstimateEmailResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EstimateEmailResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, EstimateEmailResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EstimateEmailResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('estimateEmailValidation'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('estimateEmailValidation');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('estimateEmailValidation'))).resolves.toBe(true);
	});

	it('resolves the capability for whichever scope the caller has, which is what the guard does', async () => {
		// The invitation recipient holds no credential, so the guard is asked about a scope with no tenant
		// and the feature service answers for that scope. That is the guard's own contract — this suite
		// pins that the resolver declares the code the guard reads, not what the installation stores for a
		// given scope. The delivered REST route is not gated by that code and keeps serving that caller.
		const { guard, featureService } = gate(false);

		await guard.canActivate(graphqlContext('estimateEmailValidation')).catch(() => undefined);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledTimes(1);
	});
});
