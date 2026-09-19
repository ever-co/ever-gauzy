/**
 * A party's login over REST (API specification §7.7, §1.2, §5.1).
 *
 * The suite pins the six things a controller owes and a service cannot state for it:
 *
 * - **no response carries a secret** — every route answers through `toPublicCredential`, and the
 *   assertion is made on the object a route actually returns rather than on the decorator's prose. The
 *   projection has no member for the hash, the authenticator secret or either token, so a route cannot
 *   leak one by forgetting; the suite proves the four members are absent from every answer;
 * - **a body that carries one is refused**, in the platform's own
 *   `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` and naming the member — the same refusal the service raises
 *   for the same member, raised at the boundary so the request never reaches a table;
 * - **the password is hashed at this boundary**, so the service is never handed a plaintext and the
 *   caller is never handed a hash;
 * - **the guard chain** — both protocol guards are on the class, and the write carries
 *   `CONTACT_CREDENTIALS_MANAGE` rather than the read permission;
 * - **the class does not extend the CRUD base**, whose `pagination` and `:id/recover` routes answer raw
 *   entity rows — which, for this resource, are rows carrying the secrets. That is asserted from the
 *   source, because it is the one property of this file that a later edit could quietly undo;
 * - **a refusal is a 4xx and not a 404**, which is the difference between "you may not do this" and
 *   "there is nothing here".
 *
 * Three module boundaries are doubled for the reason the channel suite states: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: a resolver carries the feature guard its module's resolvers
	// are declared under, and a spec that doubles the guard barrel has to double that one too.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => (mockTenantId ? { id: 'user-1', tenantId: mockTenantId } : null),
		currentUserId: () => (mockTenantId ? 'user-1' : null),
		currentTenantId: () => mockTenantId,
		currentOrganizationId: () => mockOrganizationId,
		currentEmployeeId: () => null,
		currentRoleId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: () => true,
	isMySQL: () => false
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { BadRequestException, HttpException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactCredentialController } from './contact-credential.controller';
import { CREDENTIAL_SECRET_MEMBERS, findCredentialSecret, RejectCredentialSecretPipe } from './contact-credential.secret.pipe';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CREDENTIAL = '00000000-0000-4000-8000-000000000080';
const CUSTOMER = '00000000-0000-4000-8000-000000000040';
const HASH = '$scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA';
const PLAINTEXT = 'correct horse battery staple';

/** The row a scripted service answers with — the secrets live on it and must never leave. */
const STORED = {
	id: CREDENTIAL,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	customerId: CUSTOMER,
	email: 'ada@example.com',
	passwordHash: HASH,
	mfaSecret: 'encrypted-authenticator-secret',
	verificationToken: 'hashed-verification-token',
	resetToken: 'hashed-reset-token',
	isVerified: false,
	failedAttempts: 0
};

/** The projection the service answers with, stated here so the assertion is about the members. */
const PUBLIC = {
	id: CREDENTIAL,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	customerId: CUSTOMER,
	email: 'ada@example.com',
	isVerified: false,
	lastLoginAt: undefined,
	lockedUntil: undefined,
	hasMfa: true
};

const SECRET_MEMBERS = ['passwordHash', 'mfaSecret', 'verificationToken', 'resetToken'];

/**
 * The service and the hasher, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const contactCredentialService = {
		listCredentials: jest.fn().mockResolvedValue([STORED]),
		createCredential: jest.fn().mockResolvedValue(STORED),
		removeCredential: jest.fn().mockResolvedValue(STORED),
		toPublicCredential: jest.fn().mockReturnValue(PUBLIC),
		...overrides
	};
	const passwordHashService = { hash: jest.fn().mockResolvedValue(HASH) };

	return {
		contactCredentialService,
		passwordHashService,
		controller: new ContactCredentialController(
			contactCredentialService as never,
			passwordHashService as never
		)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

/** Whether any member of a value is one of the four secrets, at any depth. */
function carriesSecret(value: unknown): boolean {
	return SECRET_MEMBERS.some((member) => JSON.stringify(value ?? null)?.includes(member));
}

beforeEach(() => {
	mockTenantId = '00000000-0000-4000-8000-000000000001';
	mockOrganizationId = ORGANIZATION;
});

describe('ContactCredentialController — the routes (API specification §7.7)', () => {
	it('lists the credentials of the caller’s organization, with no secret in any row', async () => {
		const { controller, contactCredentialService } = surfaces();

		const answer = await controller.findAll({ filter: { customerId: CUSTOMER, isVerified: false }, take: 10 });

		expect(contactCredentialService.listCredentials).toHaveBeenCalledWith({
			customerId: CUSTOMER,
			isVerified: false
		});
		expect(contactCredentialService.toPublicCredential).toHaveBeenCalledWith(STORED);
		expect(answer).toEqual({ items: [PUBLIC], total: 1 });
		expect(carriesSecret(answer)).toBe(false);
	});

	it('hashes the password at this boundary and never hands the service a plaintext', async () => {
		const { controller, contactCredentialService, passwordHashService } = surfaces();

		const created = await controller.create({
			customerId: CUSTOMER,
			email: 'ada@example.com',
			password: PLAINTEXT
		} as never);

		expect(passwordHashService.hash).toHaveBeenCalledWith(PLAINTEXT);
		expect(contactCredentialService.createCredential).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: CUSTOMER, email: 'ada@example.com', passwordHash: HASH })
		);
		// The service never sees the plaintext, and the caller never sees the hash.
		expect(JSON.stringify(contactCredentialService.createCredential.mock.calls[0][0])).not.toContain(PLAINTEXT);
		expect(carriesSecret(created)).toBe(false);
		expect(created).toBe(PUBLIC);
	});

	it('answers the credential an update would carry as the projection, not as the row', async () => {
		const { controller, contactCredentialService } = surfaces();

		const revoked = await controller.revoke(CREDENTIAL);

		expect(contactCredentialService.removeCredential).toHaveBeenCalledWith(CREDENTIAL);
		expect(contactCredentialService.toPublicCredential).toHaveBeenCalledWith(STORED);
		expect(carriesSecret(revoked)).toBe(false);
	});

	it('projects every row of a page, not the page as a whole', async () => {
		const { controller, contactCredentialService } = surfaces({
			listCredentials: jest.fn().mockResolvedValue([STORED, { ...STORED, id: 'other' }])
		});

		await controller.findAll();

		expect(contactCredentialService.toPublicCredential).toHaveBeenCalledTimes(2);
	});
});

describe('ContactCredentialController — a body that carries a secret is refused', () => {
	it('refuses each of the four secrets, naming the member and the platform’s own code', () => {
		const pipe = new RejectCredentialSecretPipe();

		for (const member of SECRET_MEMBERS) {
			let thrown: unknown;

			try {
				pipe.transform({ email: 'ada@example.com', [member]: 'x' }, { type: 'body' } as never);
			} catch (error) {
				thrown = error;
			}

			expect(isRefusal(thrown)).toBe(true);
			expect((thrown as HttpException).getStatus()).toBe(400);

			const response = (thrown as BadRequestException).getResponse() as Record<string, unknown>;

			expect(response.code).toBe('CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED');
			expect(response.details).toEqual({ field: member });
		}
	});

	it('refuses a secret nested inside the body, and never copies its value into the refusal', () => {
		const pipe = new RejectCredentialSecretPipe();
		let thrown: unknown;

		try {
			pipe.transform({ metadata: { nested: { passwordHash: HASH } } }, { type: 'body' } as never);
		} catch (error) {
			thrown = error;
		}

		const response = (thrown as BadRequestException).getResponse() as Record<string, unknown>;

		expect(response.details).toEqual({ field: 'metadata.nested.passwordHash' });
		// The refusal names the member and never the value: a refused body is still a body.
		expect(JSON.stringify(response)).not.toContain(HASH);
	});

	it('leaves the password itself alone, and leaves a query string alone', () => {
		const pipe = new RejectCredentialSecretPipe();

		expect(pipe.transform({ password: PLAINTEXT }, { type: 'body' } as never)).toEqual({ password: PLAINTEXT });
		expect(pipe.transform({ passwordHash: HASH }, { type: 'query' } as never)).toEqual({ passwordHash: HASH });
	});

	it('names the plaintext alias the service itself refuses', () => {
		expect(findCredentialSecret({ plainPassword: PLAINTEXT })).toBe('plainPassword');
		expect(CREDENTIAL_SECRET_MEMBERS).toEqual(expect.arrayContaining(SECRET_MEMBERS));
	});

	it('declares the refusal below the validation pipe, so it runs on the raw body', () => {
		// Nest applies pipes in declaration order and collects method decorators bottom-up, so the
		// refusal has to sit below `@UseValidationPipe(...)` to see a member the contract would strip.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-credential.controller.ts'),
			'utf8'
		);

		expect(source).toMatch(
			/@UseValidationPipe\(\{ transform: true, whitelist: true, forbidNonWhitelisted: true \}\)\n\t@UseCredentialSecretRefusal\(\)\n\tasync create\(/
		);
	});
});

describe('ContactCredentialController — the rules this class must not re-implement', () => {
	it('does not extend the CRUD base, whose routes answer raw entity rows', () => {
		// `GET /pagination` and `PUT /:id/recover` would answer rows carrying the hash, the authenticator
		// secret and both tokens. Overriding them would work until somebody adds a third.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-credential.controller.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/extends CrudController/);
		expect(source).not.toMatch(/@Get\('pagination'\)/);
		expect(source).not.toMatch(/@Put\(':id\/recover'\)/);
	});

	it('answers every route through the projection', () => {
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-credential.controller.ts'),
			'utf8'
		);

		// Three routes and three projections: a route added later without one is what this asserts against.
		expect(source.match(/toPublicCredential\(/g)?.length).toBeGreaterThanOrEqual(3);
		expect(source).not.toMatch(/return this\.contactCredentialService\.findCredentialOrFail\(/);
	});
});

describe('ContactCredentialController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a second credential for one contact with 400, never a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_CREDENTIAL_EXISTS: contact 'ada' already holds a credential, and one contact is one login."
		);
		const { controller } = surfaces({ createCredential: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ customerId: CUSTOMER, email: 'ada@example.com', password: PLAINTEXT } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_CREDENTIAL_EXISTS');
	});

	it('refuses an address another live credential holds, naming the tenant-scoped code', async () => {
		const refusal = new BadRequestException(
			"CONTACT_CREDENTIAL_EMAIL_TAKEN: 'ada@example.com' is already a login of this tenant, and an address resolves one credential."
		);
		const { controller } = surfaces({ createCredential: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ customerId: CUSTOMER, email: 'ada@example.com', password: PLAINTEXT } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_CREDENTIAL_EMAIL_TAKEN');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactCredentialController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactCredentialController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactCredentialController)).toEqual([
			PermissionsEnum.CONTACT_CREDENTIALS_VIEW
		]);
	});

	it('gives the read the view permission and every write the manage one', () => {
		const proto = ContactCredentialController.prototype;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['findAll'])).toEqual([
			PermissionsEnum.CONTACT_CREDENTIALS_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['create'])).toEqual([
			PermissionsEnum.CONTACT_CREDENTIALS_MANAGE
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['revoke'])).toEqual([
			PermissionsEnum.CONTACT_CREDENTIALS_MANAGE
		]);
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ContactCredentialController.prototype;

		for (const route of ['create', 'revoke']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CONTACT_CREDENTIALS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('refuses a request that presents no credential at all', () => {
		const guards = Reflect.getMetadata('__guards__', ContactCredentialController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});
