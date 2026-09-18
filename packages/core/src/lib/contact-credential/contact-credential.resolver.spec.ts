/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException } from '@nestjs/common';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactCredentialResolver } from './contact-credential.resolver';

/**
 * A party's login over GraphQL (GraphQL specification §3.2 row 4, §3.1, §6.4, §7.1–§7.2).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and
 * this suite pins the half of it that is easy to get quietly wrong — here, above all, the secret:
 *
 * - **the SDL has no member for a secret, on either side of the wire** — the output type has no
 *   `passwordHash`, `mfaSecret`, `verificationToken` or `resetToken`, and neither has the input type, so
 *   a document that names one does not compile rather than answering empty;
 * - **no row the resolver holds carries one** — the projection is applied *before* the connection is
 *   built, so the page the protocol filters, sorts and cursors over is the public shape;
 * - every root field the specification names exists **in the SDL**, read from the `.gql` files the boot
 *   loader globs;
 * - the password is hashed by the platform's password hasher at this boundary, exactly as the REST route
 *   hashes it, so one document and one request produce the same row;
 * - the writes carry `CONTACT_CREDENTIALS_MANAGE` and never the read permission;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CREDENTIAL = '00000000-0000-4000-8000-000000000080';
const OTHER_CREDENTIAL = '00000000-0000-4000-8000-000000000081';
const CUSTOMER = '00000000-0000-4000-8000-000000000040';
const HASH = '$scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA';
const PLAINTEXT = 'correct horse battery staple';

const SECRET_MEMBERS = ['passwordHash', 'mfaSecret', 'verificationToken', 'resetToken'];

/** The rows a scripted service answers with — the secrets live on them and must never leave. */
const ROWS = [
	{
		id: CREDENTIAL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		customerId: CUSTOMER,
		email: 'ada@example.com',
		passwordHash: HASH,
		mfaSecret: 'encrypted-authenticator-secret',
		verificationToken: 'hashed-verification-token',
		resetToken: 'hashed-reset-token',
		isVerified: true,
		failedAttempts: 0,
		lastLoginAt: new Date('2026-03-02T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	},
	{
		id: OTHER_CREDENTIAL,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		customerId: '00000000-0000-4000-8000-000000000041',
		email: 'grace@example.com',
		passwordHash: HASH,
		isVerified: false,
		failedAttempts: 0,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The projection, stated here so the assertion is about the members rather than about the service. */
function toPublic(row: (typeof ROWS)[number]) {
	return {
		id: row.id,
		tenantId: row.tenantId,
		organizationId: row.organizationId,
		customerId: row.customerId,
		email: row.email,
		isVerified: Boolean(row.isVerified),
		lastLoginAt: row.lastLoginAt,
		lockedUntil: undefined,
		hasMfa: Boolean(row.mfaSecret),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/** The resolver, over a scripted service and a scripted hasher. */
function surfaces() {
	const contactCredentialService = {
		listCredentials: jest.fn().mockResolvedValue(ROWS),
		createCredential: jest.fn().mockResolvedValue(ROWS[0]),
		removeCredential: jest.fn().mockResolvedValue(ROWS[0]),
		toPublicCredential: jest.fn().mockImplementation(toPublic)
	};
	const passwordHashService = { hash: jest.fn().mockResolvedValue(HASH) };

	return {
		contactCredentialService,
		passwordHashService,
		resolver: new ContactCredentialResolver(
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

/**
 * The composed schema, as text: the domain's own documents plus the kernel's, exactly the set the boot
 * loader globs and the composition pass asserts.
 */
function composedSchema(): string {
	const directories = [join(__dirname, 'schema'), join(__dirname, '..', 'graphql', 'schema')];

	const documents = directories.flatMap((directory) =>
		readdirSync(directory)
			.filter((name) => name.endsWith('.gql'))
			.map((name) => readFileSync(join(directory, name), 'utf8'))
	);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation' | 'Subscription'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

describe('ContactCredentialResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the credential connection query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['contactCredentials']));
	});

	it('declares every credential mutation the specification names', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createContactCredential', 'revokeContactCredential'])
		);
	});

	it('declares no node query, because the specification names none', () => {
		// One contact holds one login, so the credential is addressed by a filter on the list rather than
		// by a root field of its own — and a root field the specification does not name is a root field
		// the completeness rule of §3.2 forbids.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactCredential']));
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ContactCredentialConnection \{\s*nodes: \[ContactCredential!\]!\s*edges: \[ContactCredentialEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ContactCredentialEdge \{\s*node: ContactCredential!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ContactCredentialFilter \{/);
		expect(printed).toMatch(/input ContactCredentialSort \{/);
		expect(printed).toMatch(/enum ContactCredentialSortField \{/);
	});

	it('has no member for a secret on either side of the wire', () => {
		const printed = printSchema(schema);

		for (const member of SECRET_MEMBERS) {
			expect(printed).not.toContain(member);
		}

		// The readable shape has the flag and never the secret.
		expect(printed).toMatch(/hasMfa: Boolean!/);
		expect(printed).not.toMatch(/mfaSecret/);
	});
});

describe('ContactCredentialResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors, and no secret in a row', async () => {
		const { resolver, contactCredentialService } = surfaces();

		const connection = await resolver.contactCredentials(undefined, undefined, undefined, 20);

		expect(contactCredentialService.listCredentials).toHaveBeenCalledWith();
		// The projection is applied before the connection is built, so the protocol never sees the row
		// the secrets live on.
		expect(contactCredentialService.toPublicCredential).toHaveBeenCalledTimes(2);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(carriesSecret(connection)).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CREDENTIAL);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactCredentials({ isVerified: { eq: false } });

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_CREDENTIAL]);
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactCredentials(undefined, [{ field: 'email', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.email)).toEqual(['ada@example.com', 'grace@example.com']);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.contactCredentials(undefined, undefined, undefined, 1);

		const second = await resolver.contactCredentials(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_CREDENTIAL]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactCredentials(undefined, [{ field: 'hasMfa', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a secret member as a filter field, because it is not a field of the readable shape', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contactCredentials({ passwordHash: { eq: HASH } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactCredentials(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactCredentials(undefined, undefined, undefined, 500)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactCredentialResolver — one concept, two protocols, the same writes', () => {
	it('hashes the password and creates through the same service method the REST route calls', async () => {
		const { resolver, contactCredentialService, passwordHashService } = surfaces();

		const created = await resolver.createContactCredential({
			organizationId: ORGANIZATION,
			customerId: CUSTOMER,
			email: 'ada@example.com',
			password: PLAINTEXT
		});

		expect(passwordHashService.hash).toHaveBeenCalledWith(PLAINTEXT);
		expect(contactCredentialService.createCredential).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: CUSTOMER, email: 'ada@example.com', passwordHash: HASH })
		);
		expect(carriesSecret(created)).toBe(false);
	});

	it('revokes through the same service method and answers the projection', async () => {
		const { resolver, contactCredentialService } = surfaces();

		const revoked = await resolver.revokeContactCredential(CREDENTIAL);

		expect(contactCredentialService.removeCredential).toHaveBeenCalledWith(CREDENTIAL);
		expect(contactCredentialService.toPublicCredential).toHaveBeenCalledWith(ROWS[0]);
		expect(carriesSecret(revoked)).toBe(false);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const refusal = new BadRequestException(
			'CONTACT_CREDENTIAL_LOCKED: too many failed attempts. Try again after 2026-03-01T10:00:00.000Z.'
		);
		const contactCredentialService = {
			listCredentials: jest.fn().mockResolvedValue(ROWS),
			removeCredential: jest.fn().mockRejectedValue(refusal),
			toPublicCredential: jest.fn().mockImplementation(toPublic)
		};
		const resolver = new ContactCredentialResolver(contactCredentialService as never, {} as never);

		const error = await resolver.revokeContactCredential(CREDENTIAL).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_CREDENTIAL_LOCKED');
	});
});

describe('ContactCredentialResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactCredentialResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the manage permission on every write', () => {
		const proto = ContactCredentialResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['contactCredentials', PermissionsEnum.CONTACT_CREDENTIALS_VIEW],
			['createContactCredential', PermissionsEnum.CONTACT_CREDENTIALS_MANAGE],
			['revokeContactCredential', PermissionsEnum.CONTACT_CREDENTIALS_MANAGE]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactCredentialResolver)).toEqual([
			PermissionsEnum.CONTACT_CREDENTIALS_VIEW
		]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ContactCredentialResolver.prototype;

		for (const field of ['createContactCredential', 'revokeContactCredential']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.CONTACT_CREDENTIALS_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('offers no root field for the customer-authentication surface it cannot establish', () => {
		// The login, refresh, logout, verification and reset rows all assume a contact subject, which the
		// request context has no way to carry: issuing a token here would be a second authentication path.
		expect(rootFields('Mutation')).not.toEqual(
			expect.arrayContaining([
				'loginContact',
				'refreshContactCredential',
				'logoutContactCredential',
				'verifyContactCredentialEmail',
				'requestContactCredentialReset'
			])
		);
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactCredentialByEmail']));
	});
});
