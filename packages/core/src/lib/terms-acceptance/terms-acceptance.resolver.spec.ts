/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PUBLIC_METHOD_METADATA, FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TermsAcceptanceController } from './terms-acceptance.controller';
import { TermsAcceptanceResolver } from './terms-acceptance.resolver';

/**
 * The published legal corpus over GraphQL.
 *
 * The delivered controller serves one route — the documents a new account must accept — and it is
 * `@Public()`, because the forms that read it run before any account exists. This suite pins the half of
 * the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - the one capability the route serves is one root field of the composed schema, and it answers a list
 *   rather than a connection, because the route answers a list: the corpus is short, ordered and
 *   complete, so a cursor and a total over it would be machinery for a problem this read does not have;
 * - the field reaches the same `getRequiredDocuments` call the route makes, with the same locale;
 * - **the field states exactly what its route states** — the public marker, no guard and no permission —
 *   so a caller is not given a narrower or a wider door than the REST route gives it;
 * - the gate is on the class, and the limitation it creates for a public field is asserted rather than
 *   assumed.
 */

/**
 * The documents a scripted service answers with, in the order the corpus publishes them.
 */
const DOCUMENTS = [
	{
		documentId: 'tos:gauzy',
		version: '1.0.0',
		sha256: 'a'.repeat(64),
		locale: 'en-US',
		url: '/legal/tos',
		title: 'Terms of Service',
		effectiveDate: '2026-01-01'
	},
	{
		documentId: 'privacy:gauzy',
		version: '2.1.0',
		sha256: 'b'.repeat(64),
		locale: 'en-US',
		url: '/legal/privacy',
		title: 'Privacy Policy'
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const termsAcceptanceService = {
		getRequiredDocuments: jest.fn().mockReturnValue(DOCUMENTS)
	};

	return {
		termsAcceptanceService,
		resolver: new TermsAcceptanceResolver(termsAcceptanceService as never)
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
		.filter((field) => field.toLowerCase().includes('termsacceptance'))
		.sort();
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof TermsAcceptanceController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Whether one handler carries the platform's public marker. */
function isPublic(controller: typeof TermsAcceptanceController, handler: string): boolean {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return Boolean(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handlers[handler]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = TermsAcceptanceResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Whether one resolver field carries the platform's public marker. */
function isPublicField(field: string): boolean {
	const fields = TermsAcceptanceResolver.prototype as unknown as Record<string, object>;

	return Boolean(Reflect.getMetadata(PUBLIC_METHOD_METADATA, fields[field]));
}

describe('TermsAcceptanceResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the document query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['termsAcceptanceDocuments']));
	});

	it('declares the read the controller serves, and no more', () => {
		// The controller declares one route and writes nothing, so a count field, a node field and any
		// mutation would each be a capability with no delivered route behind it.
		expect(ownedRootFields('Query')).toEqual(['termsAcceptanceDocuments']);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('answers a list rather than a connection, because the route answers a list', () => {
		// The corpus is short, ordered and complete: there is no page to walk and no total to state.
		expect(printed).toMatch(/termsAcceptanceDocuments\([^)]*\): \[TermsAcceptanceDocument!\]!/);
		expect(printed).not.toMatch(/type TermsAcceptanceDocumentConnection/);
	});

	it('carries the corpus entry, the digest included', () => {
		const body = printed.match(/type TermsAcceptanceDocument \{([\s\S]*?)\n\}/)?.[1] ?? '';

		expect(body).toMatch(/documentId: String!/);
		expect(body).toMatch(/version: String!/);
		// The digest is the member that turns a checkbox into evidence: it is why this shape exists.
		expect(body).toMatch(/sha256: String!/);
		expect(body).toMatch(/locale: String!/);
		// Optional in the corpus, nullable here for exactly that reason.
		expect(body).toMatch(/url: String\b/);
		expect(body).toMatch(/title: String\b/);
		expect(body).toMatch(/effectiveDate: String\b/);
	});

	it('offers no argument the read cannot honour', () => {
		// The route takes a locale and nothing else: no page, no filter, no order.
		expect(printed).not.toMatch(/termsAcceptanceDocuments\([^)]*filter/);
		expect(printed).not.toMatch(/termsAcceptanceDocuments\([^)]*limit/);
	});
});

describe('TermsAcceptanceResolver — one concept, two protocols, the same read', () => {
	it('reads the documents through the same service method the REST route calls', async () => {
		const { resolver, termsAcceptanceService } = surfaces();

		expect(await resolver.termsAcceptanceDocuments('en-US')).toEqual(DOCUMENTS);
		expect(termsAcceptanceService.getRequiredDocuments).toHaveBeenCalledWith('en-US');
	});

	it('leaves the locale unstated when the caller states none, which is the route’s own default', async () => {
		const { resolver, termsAcceptanceService } = surfaces();

		await resolver.termsAcceptanceDocuments();

		// The service resolves the corpus's own default rendering for an unstated locale; stating
		// English here would be a default this surface invented.
		expect(termsAcceptanceService.getRequiredDocuments).toHaveBeenCalledWith(undefined);
	});
});

describe('TermsAcceptanceResolver — the guard stack and the permission are the controller’s', () => {
	it('states no guard on the class beyond the gate, because the controller states none', () => {
		// The delivered handler declares no guard and no permission: a guard here would refuse a caller
		// the REST route serves — and the caller this read exists for has no credential at all.
		expect(guardsOfRoute(TermsAcceptanceController, 'getRequiredDocuments')).toEqual([]);
		expect(Reflect.getMetadata('__guards__', TermsAcceptanceResolver)).toEqual([FeatureFlagGuard]);
		expect(Reflect.getMetadata('__guards__', TermsAcceptanceResolver)).not.toContain(TenantPermissionGuard);
		expect(Reflect.getMetadata('__guards__', TermsAcceptanceResolver)).not.toContain(PermissionGuard);
	});

	it('states the public marker on the field, exactly as the route states it', () => {
		expect(isPublic(TermsAcceptanceController, 'getRequiredDocuments')).toBe(true);
		expect(isPublicField('termsAcceptanceDocuments')).toBe(true);
	});

	it('states no permission anywhere, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TermsAcceptanceController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TermsAcceptanceResolver)).toBeUndefined();
		expect(permissionOfField('termsAcceptanceDocuments')).toBeUndefined();
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
		getHandler: () => (TermsAcceptanceResolver.prototype as never)[field],
		getClass: () => TermsAcceptanceResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('TermsAcceptanceResolver — a capability that is switched off is not served', () => {
	it('declares the capability the catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, TermsAcceptanceResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', TermsAcceptanceResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('termsAcceptanceDocuments'))
			.catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect((refusal as Error).message).toContain('termsAcceptanceDocuments');
		expect((refusal as { getStatus(): number }).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('termsAcceptanceDocuments'))).resolves.toBe(true);
	});

	it('carries the gate over a public field, which is the limitation the class comment records', async () => {
		// The public marker opens the field to a caller without a credential; it does not lift the gate
		// over it. A request that carries no tenant scope resolves the capability as disabled, so a
		// caller reading the signup documents is refused while the capability is off — a narrower door
		// than the route mirrors, and the delivery has no way to state otherwise.
		const { guard } = gate(false);

		const refusal = await guard
			.canActivate(graphqlContext('termsAcceptanceDocuments'))
			.catch((thrown) => thrown);

		expect(isPublicField('termsAcceptanceDocuments')).toBe(true);
		expect(refusal).toBeInstanceOf(Error);
		expect(Reflect.getMetadata(FEATURE_METADATA, TermsAcceptanceResolver)).toBe(FEATURE_GRAPHQL);
	});
});
