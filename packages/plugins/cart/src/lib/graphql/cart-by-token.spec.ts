/**
 * `cartByToken` and its REST twin, `GET /carts/by-token` with the token in the `X-Cart-Token` header.
 *
 * The field was declared in the document with no resolver behind it — a name a client could select and
 * that answered nothing — because the cart had no token to look up. It has one now: the create issues a
 * random token, answers it once, and stores its digest. This suite pins the surface the token is read
 * through, on both protocols at once, because §3.1's rule is that GraphQL is never wider than REST:
 *
 * - the document declares the field with the one argument the route takes, answering a nullable cart,
 *   and gives the cart a nullable `token` that only the create fills — no input carries a token or its
 *   digest, and the cart type never declares the digest;
 * - the field and the route reach the same service lookup with the same token, the field answering null
 *   where the route answers 404;
 * - both run under the same grant — neither states one of its own, so both resolve to their class's
 *   `CARTS_VIEW`, the grant the cart's read route runs under — and under the same guard chain;
 * - over HTTP, the token rides in a header and never in the path: a URL is written to every access log,
 *   proxy log and error report on the way (CWE-598), a header is not, and the route is matched before the
 *   id-addressed read it now shares a segment count with.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason this package's other suites state. The
 * permission decorator is the kernel's own, because "the same grant" is a statement about the metadata it
 * writes, and a double that wrote nothing would have the comparison pass on two absences.
 */
jest.mock('../commerce-cart/commerce-cart.service', () => ({ CommerceCartService: class CommerceCartService {} }));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudController: class CrudController {
			constructor(protected readonly service: any) {}
		},
		// The kernel's own pipe: the id-addressed read refuses a segment that is not a UUID, which is half of why
		// `by-token` can never name a cart.
		UUIDValidationPipe: jest.requireActual('@gauzy/core/src/lib/shared/pipes/uuid-validation.pipe').UUIDValidationPipe,
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		VERSIONED_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
		Versioned: (options: any = {}) =>
			require('@nestjs/common').SetMetadata(
				jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').VERSIONED_METADATA_KEY,
				options
			),
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		}
	};
});

import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import {
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	ObjectTypeExtensionNode,
	TypeNode
} from 'graphql';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CommerceCartController } from '../commerce-cart/commerce-cart.controller';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartResolver } from './commerce-cart.resolver';
import { cartSchemaExtensions } from './schema-extensions';

/** The token a buyer was answered with, and the cart it names. */
const TOKEN = 'n2cZ0Rk1pX8vQm4yLw6tJe3sHa9fBd7uGc5iKo1xYzA';
const CART = { id: '00000000-0000-4000-8000-000000000095', version: 2, grandTotal: '42.000000', lines: [] };

/** One object type or extension of the document, by name. */
function objectType(name: string): ObjectTypeDefinitionNode | ObjectTypeExtensionNode {
	const found = cartSchemaExtensions.definitions.find(
		(definition): definition is ObjectTypeDefinitionNode | ObjectTypeExtensionNode =>
			(definition.kind === 'ObjectTypeDefinition' || definition.kind === 'ObjectTypeExtension') &&
			definition.name.value === name
	);

	if (!found) {
		throw new Error(`the cart document declares no type named "${name}"`);
	}

	return found;
}

/** One field of an object type, by name, or undefined when the type does not declare it. */
function fieldOf(type: string, name: string): FieldDefinitionNode | undefined {
	return objectType(type).fields?.find((field) => field.name.value === name);
}

/** The name of the type behind whatever wrappers a declaration states. */
function namedTypeName(type: TypeNode): string {
	let current = type;

	while (current.kind === 'NonNullType' || current.kind === 'ListType') {
		current = current.type;
	}

	return current.kind === 'NamedType' ? current.name.value : '';
}

/** The permission a surface runs under: what its handler states, else what its class states. */
function permissionOf(surface: new (...args: any[]) => any, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (surface.prototype as any)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, surface)
	);
}

/** The guards a surface runs under, the class chain first and the handler's own appended. */
function guardsOf(surface: new (...args: any[]) => any, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', surface) ?? [];
	const restated = Reflect.getMetadata('__guards__', (surface.prototype as any)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** Both surfaces over one stubbed service. */
function surfaces(answer: unknown) {
	const service = { findByToken: jest.fn().mockResolvedValue(answer) };

	return {
		service,
		controller: new CommerceCartController(service as never),
		resolver: new CommerceCartResolver(service as never)
	};
}

describe('the cart document — the token is read through one field, and written by none', () => {
	it('declares cartByToken with the one argument the route takes, answering a nullable cart', () => {
		const field = fieldOf('Query', 'cartByToken');

		expect(field).toBeDefined();
		expect(field?.arguments?.map((argument) => argument.name.value)).toEqual(['token']);
		expect(field?.arguments?.[0].type.kind).toBe('NonNullType');
		expect(namedTypeName(field?.arguments?.[0].type as TypeNode)).toBe('String');
		// A miss is the row's absence, so the answer is nullable — as the `cart` field beside it is.
		expect(field?.type.kind).toBe('NamedType');
		expect(namedTypeName(field?.type as TypeNode)).toBe('Cart');
	});

	it('gives the cart a nullable token, and never its digest', () => {
		const token = fieldOf('Cart', 'token');

		expect(token).toBeDefined();
		// Nullable: every read answers null, because only the create has the plaintext to put there.
		expect(token?.type.kind).toBe('NamedType');
		expect(namedTypeName(token?.type as TypeNode)).toBe('String');
		expect(fieldOf('Cart', 'tokenHash')).toBeUndefined();
	});

	it('lets no input state a token or its digest', () => {
		const inputs = cartSchemaExtensions.definitions.filter(
			(definition): definition is InputObjectTypeDefinitionNode => definition.kind === 'InputObjectTypeDefinition'
		);

		// The control: the document does declare inputs, so the loop below has something to read.
		expect(inputs.map((input) => input.name.value)).toEqual(expect.arrayContaining(['CreateCartInput', 'UpdateCartInput']));

		for (const input of inputs) {
			const members = (input.fields ?? []).map((field) => field.name.value);

			expect(members).not.toContain('token');
			expect(members).not.toContain('tokenHash');
		}
	});
});

describe('cartByToken and GET /carts/by-token — one lookup, two protocols', () => {
	it('reach the same service lookup with the same token, and answer the same cart', async () => {
		const { service, controller, resolver } = surfaces(CART);

		const overRest = await controller.findByToken(TOKEN);
		const overGraphql = await resolver.cartByToken(TOKEN);

		expect(service.findByToken).toHaveBeenNthCalledWith(1, TOKEN);
		expect(service.findByToken).toHaveBeenNthCalledWith(2, TOKEN);
		expect(service.findByToken).toHaveBeenCalledTimes(2);
		expect(overGraphql).toBe(overRest);
	});

	it('answer a token no cart carries with null over GraphQL and 404 over REST', async () => {
		const { service, controller, resolver } = surfaces(null);

		await expect(resolver.cartByToken('not-a-token')).resolves.toBeNull();
		await expect(controller.findByToken('not-a-token')).rejects.toBeInstanceOf(NotFoundException);
		expect(service.findByToken).toHaveBeenCalledTimes(2);
	});

	it('run under the grant the cart read route runs under, stated by neither handler', () => {
		// Neither handler states a grant of its own, so each resolves to its class's — the read grant.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CommerceCartController.prototype.findByToken)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, CommerceCartResolver.prototype.cartByToken)).toBeUndefined();
		expect(permissionOf(CommerceCartController, 'findByToken')).toEqual([CART_PERMISSIONS.CARTS_VIEW]);
		expect(permissionOf(CommerceCartResolver, 'cartByToken')).toEqual(permissionOf(CommerceCartController, 'findByToken'));
		// The cart's id-addressed read runs under the same one, which is what "the same read by another
		// key" means.
		expect(permissionOf(CommerceCartController, 'findById')).toEqual(permissionOf(CommerceCartController, 'findByToken'));
	});

	it('run the field under the guard chain the route runs under', () => {
		const routeGuards = guardsOf(CommerceCartController, 'findByToken');

		expect(routeGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(guardsOf(CommerceCartResolver, 'cartByToken')).toEqual(expect.arrayContaining(routeGuards));
	});

	it('states that the field does not write, because a GraphQL operation is always a POST', () => {
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, CommerceCartResolver.prototype.cartByToken)).toMatchObject({
			write: false
		});
	});
});

/**
 * The route over HTTP, through Nest's own router: the real controller, the real parameter decorators and the
 * kernel's UUID pipe, with only the service doubled and the two guards let through (what they decide is the
 * same for every cart route, and `run under the grant …` above pins that this one carries them).
 */
describe('GET /carts/by-token — the token rides in a header, never in the path', () => {
	let app: INestApplication | undefined;

	/** Boots the controller over a stubbed service that answers `cart` for TOKEN and nothing for anything else. */
	async function start() {
		const service = {
			findByToken: jest.fn(async (token: string) => (token === TOKEN ? CART : null)),
			findOneWithContent: jest.fn(async (id: string) => ({ ...CART, id }))
		};
		const moduleRef = await Test.createTestingModule({
			controllers: [CommerceCartController],
			providers: [{ provide: CommerceCartService, useValue: service }]
		})
			.overrideGuard(TenantPermissionGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionGuard)
			.useValue({ canActivate: () => true })
			.compile();

		app = moduleRef.createNestApplication({ logger: false });
		await app.init();

		return { service, http: () => request(app?.getHttpServer()) };
	}

	afterEach(async () => {
		await app?.close();
		app = undefined;
	});

	it('reads the token from the X-Cart-Token header, and reaches the token lookup rather than the id read', async () => {
		const { service, http } = await start();

		const response = await http().get('/carts/by-token').set('X-Cart-Token', TOKEN);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ id: CART.id });
		expect(service.findByToken).toHaveBeenCalledWith(TOKEN);
		// `by-token` is one segment now, as an id is: the route is matched first, and the id read never runs.
		expect(service.findOneWithContent).not.toHaveBeenCalled();
	});

	it('refuses a request without the header, or with a blank one, with 400 before any lookup', async () => {
		const { service, http } = await start();

		for (const response of [
			await http().get('/carts/by-token'),
			await http().get('/carts/by-token').set('X-Cart-Token', '   ')
		]) {
			expect(response.status).toBe(400);
			expect(JSON.stringify(response.body)).toContain('CART_TOKEN_REQUIRED');
		}

		expect(service.findByToken).not.toHaveBeenCalled();
		expect(service.findOneWithContent).not.toHaveBeenCalled();
	});

	it('answers 404 for a token no cart carries', async () => {
		const { service, http } = await start();

		const response = await http().get('/carts/by-token').set('X-Cart-Token', 'not-a-token');

		expect(response.status).toBe(404);
		expect(service.findByToken).toHaveBeenCalledWith('not-a-token');
	});

	it('the path no longer carries a token: the old two-segment shape reaches no handler', async () => {
		const { service, http } = await start();

		const response = await http().get(`/carts/by-token/${TOKEN}`);

		expect(response.status).toBe(404);
		expect(service.findByToken).not.toHaveBeenCalled();
		expect(service.findOneWithContent).not.toHaveBeenCalled();
	});

	it('still serves the id read beside it, and could never take `by-token` for an id', async () => {
		const { service, http } = await start();

		// The control: a cart id reaches the id read.
		const byId = await http().get(`/carts/${CART.id}`);

		expect(byId.status).toBe(200);
		expect(service.findOneWithContent).toHaveBeenCalledWith(CART.id);
		// A cart id is a UUID, which `by-token` is not: the id read's own pipe refuses the segment.
		const uuidPipe = new (jest.requireActual('@gauzy/core/src/lib/shared/pipes/uuid-validation.pipe').UUIDValidationPipe)();

		expect(() => uuidPipe.transform('by-token', { type: 'param' })).toThrow('valid uuid is expected');
		expect(uuidPipe.transform(CART.id, { type: 'param' })).toBe(CART.id);
	});
});
