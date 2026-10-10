// cspell:ignore termsacceptance
/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PUBLIC_METHOD_METADATA, FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TermsAcceptanceController } from './terms-acceptance.controller';
import { TermsAcceptanceResolver } from './terms-acceptance.resolver';
import { TermsAcceptanceService } from './terms-acceptance.service';

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

/** The acceptance records a scripted recorder answers with, newest first. */
const RECORDS = [
	{
		id: 'acc-2',
		subjectId: 'user-1',
		tenantId: 'tenant-1',
		documentId: 'privacy:gauzy',
		version: '2.1.0',
		sha256: 'b'.repeat(64),
		acceptedAt: '2026-09-01T10:00:00.000Z',
		locale: 'en-US',
		ipHash: null,
		userAgent: null,
		method: 'api',
		fingerprint: 'f'.repeat(64)
	},
	{
		id: 'acc-1',
		subjectId: 'user-1',
		tenantId: 'tenant-1',
		documentId: 'tos:gauzy',
		version: '1.0.0',
		sha256: 'a'.repeat(64),
		acceptedAt: '2026-01-01T10:00:00.000Z',
		locale: 'en-US',
		ipHash: null,
		userAgent: null,
		method: 'signup-checkbox',
		fingerprint: 'e'.repeat(64)
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const termsAcceptanceService = {
		getRequiredDocuments: jest.fn().mockReturnValue(DOCUMENTS),
		acceptAsCaller: jest.fn().mockResolvedValue(RECORDS.slice(0, 1)),
		historyOfCaller: jest.fn().mockResolvedValue(RECORDS)
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

	it('declares the reads the controller serves, and no more', () => {
		// Three routes: the corpus, the caller's history and the caller's acceptance. A count field or a node
		// field would each be a capability with no delivered route behind it.
		expect(ownedRootFields('Query')).toEqual(['termsAcceptanceDocuments', 'termsAcceptances']);
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['acceptTerms']));
	});

	it('declares the caller’s history as a connection and the acceptance as the records it wrote', () => {
		expect(printed).toMatch(/termsAcceptances\([^)]*\): TermsAcceptanceConnection!/);
		// No user argument anywhere: both act on the credential's person only.
		expect(printed).not.toMatch(/termsAcceptances\([^)]*userId/);
		expect(printed).toMatch(/acceptTerms\(input: AcceptTermsInput!\): \[TermsAcceptance!\]!/);
		expect(printed).not.toMatch(/input AcceptTermsInput \{[^}]*userId/);

		const body = printed.match(/type TermsAcceptance \{([\s\S]*?)\n\}/)?.[1] ?? '';
		expect(body).toMatch(/sha256: String!/);
		expect(body).toMatch(/acceptedAt: DateTime!/);
		// The device-identifying members the recorder keeps are not projected.
		expect(body).not.toMatch(/ipHash/);
		expect(body).not.toMatch(/userAgent/);
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

	it('records the caller’s acceptance through the same service method the accept route calls', async () => {
		const { resolver, termsAcceptanceService } = surfaces();
		const claim = { documentId: 'privacy:gauzy', version: '2.1.0', sha256: 'b'.repeat(64), locale: 'en-US' };

		expect(await resolver.acceptTerms({ terms: [claim] })).toEqual(RECORDS.slice(0, 1));
		expect(termsAcceptanceService.acceptAsCaller).toHaveBeenCalledWith([claim]);

		const controller = new TermsAcceptanceController(termsAcceptanceService as never);
		await controller.accept({ terms: [claim] });
		expect(termsAcceptanceService.acceptAsCaller).toHaveBeenLastCalledWith([claim]);
	});

	it('reads the caller’s history through the same service method the route calls, as a connection', async () => {
		const { resolver, termsAcceptanceService } = surfaces();

		const connection = await resolver.termsAcceptances();
		expect(termsAcceptanceService.historyOfCaller).toHaveBeenCalledWith();
		expect(connection.totalCount).toBe(2);
		expect(connection.nodes.map((node) => node.id)).toEqual(['acc-2', 'acc-1']);

		const narrowed = await resolver.termsAcceptances({ documentId: { eq: 'tos:gauzy' } });
		expect(narrowed.nodes.map((node) => node.id)).toEqual(['acc-1']);

		const controller = new TermsAcceptanceController(termsAcceptanceService as never);
		expect(await controller.acceptances()).toEqual(RECORDS);
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

	it('states no permission on the corpus read or on either class, because the controller states none there', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TermsAcceptanceController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, TermsAcceptanceResolver)).toBeUndefined();
		expect(permissionOfField('termsAcceptanceDocuments')).toBeUndefined();
	});

	it('runs the caller’s acceptance and history under the guards and the grant their routes state', () => {
		const handlers = TermsAcceptanceController.prototype as unknown as Record<string, object>;
		const fields = TermsAcceptanceResolver.prototype as unknown as Record<string, object>;

		for (const [field, handler] of [
			['acceptTerms', 'accept'],
			['termsAcceptances', 'acceptances']
		] as const) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.PROFILE_EDIT]);
			expect(permissionOfField(field)).toEqual(Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]));
			expect(Reflect.getMetadata('__guards__', fields[field])).toEqual([TenantPermissionGuard, PermissionGuard]);
			expect(guardsOfRoute(TermsAcceptanceController, handler)).toEqual([TenantPermissionGuard, PermissionGuard]);
			// Neither is public: the person is the credential's, so a call without one has no subject.
			expect(isPublicField(field)).toBe(false);
			expect(isPublic(TermsAcceptanceController, handler)).toBe(false);
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

describe('TermsAcceptanceService — an acceptance is always the caller’s own, and always published text', () => {
	const USER = 'user-1';
	const TENANT = 'tenant-1';

	/** The service over a repository it never reaches: recording and history are spied. */
	function service() {
		const instance = new TermsAcceptanceService({} as never);
		const record = jest.spyOn(instance, 'record').mockResolvedValue(RECORDS as never);
		const history = jest.spyOn(instance, 'history').mockResolvedValue(RECORDS as never);

		return { instance, record, history };
	}

	/** A claim the published corpus does carry, read from the corpus itself. */
	function publishedClaim(instance: TermsAcceptanceService) {
		const [document] = instance.getRequiredDocuments();

		return {
			documentId: document.documentId,
			version: document.version,
			sha256: document.sha256,
			locale: document.locale
		};
	}

	afterEach(() => jest.restoreAllMocks());

	it('records a published claim for the credential’s user and tenant, by the API method', async () => {
		const { instance, record } = service();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({
			ip: '203.0.113.7',
			headers: { 'user-agent': 'spec' }
		});
		const claim = publishedClaim(instance);

		await instance.acceptAsCaller([claim]);

		expect(record).toHaveBeenCalledWith(USER, [claim], {
			tenantId: TENANT,
			method: 'api',
			ip: '203.0.113.7',
			userAgent: 'spec'
		});
	});

	it('refuses a digest the corpus never published, before anything is written', async () => {
		const { instance, record } = service();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		const forged = { ...publishedClaim(instance), sha256: '0'.repeat(64) };

		await expect(instance.acceptAsCaller([forged])).rejects.toBeInstanceOf(BadRequestException);
		expect(record).not.toHaveBeenCalled();
	});

	it('refuses an empty or an oversized batch, whichever protocol it arrived over', async () => {
		const { instance, record } = service();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		const claim = publishedClaim(instance);

		await expect(instance.acceptAsCaller([])).rejects.toBeInstanceOf(BadRequestException);
		await expect(instance.acceptAsCaller(Array.from({ length: 21 }, () => claim))).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(record).not.toHaveBeenCalled();
	});

	it('refuses a request that carries no user, for the write and for the read', async () => {
		const { instance, record, history } = service();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		await expect(instance.acceptAsCaller([publishedClaim(instance)])).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		await expect(instance.historyOfCaller()).rejects.toBeInstanceOf(UnauthorizedException);
		expect(record).not.toHaveBeenCalled();
		expect(history).not.toHaveBeenCalled();
	});

	it('reads the history of the credential’s user in the credential’s tenant only', async () => {
		const { instance, history } = service();
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		expect(await instance.historyOfCaller()).toEqual(RECORDS);
		expect(history).toHaveBeenCalledWith(USER, TENANT);
	});
});
