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
import { ContactBuyerRole, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactBuyerResolver } from './contact-buyer.resolver';

/**
 * Company-account membership over GraphQL (GraphQL specification §3.2 row 4, §3.1, §7.1–§7.2, §9.7).
 *
 * The programme's API doctrine is one concept reachable over both protocols with the same scope, and this
 * suite pins the half of it that is easy to get quietly wrong:
 *
 * - every root field the specification names for this resource exists **in the SDL**, and the resource has
 *   exactly three of them — `contactBuyers`, `createContactBuyer` and `deleteContactBuyer` — because
 *   neither side of the pivot is mutable and no node query is named;
 * - the list root field is a connection with the platform's own cursor codec behind it, so a cursor
 *   obtained over REST resumes here and a refusal is the query protocol's own code;
 * - both mutations delegate to the same service methods the REST routes call, with the same scope — a
 *   client does not choose a better surface by choosing a protocol;
 * - the writes carry `ORG_CONTACT_EDIT` and never the read permission;
 * - **the money members are `Decimal`**, never `Float`: a ceiling is an amount, and a binary fraction
 *   cannot hold a cent exactly;
 * - both protocols are tenant- and permission-guarded, asserted against the metadata a guard reads.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const MEMBERSHIP = '00000000-0000-4000-8000-000000000090';
const OTHER_MEMBERSHIP = '00000000-0000-4000-8000-000000000091';
const COMPANY = '00000000-0000-4000-8000-000000000042';
const BUYER = '00000000-0000-4000-8000-000000000040';

/** The rows a scripted service answers with, in the order the delivered list method returns them. */
const ROWS = [
	{
		id: MEMBERSHIP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		companyCustomerId: COMPANY,
		buyerCustomerId: BUYER,
		role: ContactBuyerRole.PURCHASER,
		spendingLimit: 1000,
		periodStartDay: 1,
		isActive: true,
		assignedAt: new Date('2026-03-01T10:00:00.000Z'),
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_MEMBERSHIP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		companyCustomerId: COMPANY,
		buyerCustomerId: '00000000-0000-4000-8000-000000000041',
		role: ContactBuyerRole.VIEWER,
		isActive: true,
		assignedAt: new Date('2026-02-01T10:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const contactBuyerService = {
		listBuyers: jest.fn().mockResolvedValue(ROWS),
		addBuyer: jest.fn().mockResolvedValue(ROWS[0]),
		removeBuyer: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { contactBuyerService, resolver: new ContactBuyerResolver(contactBuyerService as never) };
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
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

describe('ContactBuyerResolver — the SDL declares the root fields the specification names (§3.2 row 4)', () => {
	it('declares the membership connection query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['contactBuyers']));
	});

	it('declares the two membership mutations the specification names, and no update', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createContactBuyer', 'deleteContactBuyer'])
		);
		// Neither side of the pivot is mutable, so there is no update input and no update mutation.
		expect(rootFields('Mutation')).not.toEqual(expect.arrayContaining(['updateContactBuyer']));
	});

	it('declares no node query, because the specification names none', () => {
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['contactBuyer']));
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(
			/type ContactBuyerConnection \{\s*nodes: \[ContactBuyer!\]!\s*edges: \[ContactBuyerEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ContactBuyerEdge \{\s*node: ContactBuyer!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ContactBuyerFilter \{/);
		expect(printed).toMatch(/input ContactBuyerSort \{/);
		expect(printed).toMatch(/enum ContactBuyerSortField \{/);
		expect(printed).toMatch(/input ContactBuyerRoleFilter \{/);
	});

	it('carries the ceilings as `Decimal` and never as `Float`', () => {
		const printed = printSchema(schema);

		expect(printed).toMatch(/spendingLimit: Decimal/);
		expect(printed).toMatch(/periodSpendingLimit: Decimal/);
		expect(printed).toMatch(/approvalThreshold: Decimal/);
		// Money is never a binary fraction anywhere in this schema.
		expect(printed).not.toMatch(/spendingLimit: Float/);
	});
});

describe('ContactBuyerResolver — the connection contract (§7.1, §7.2)', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, contactBuyerService } = surfaces();

		const connection = await resolver.contactBuyers(undefined, undefined, undefined, 20);

		expect(contactBuyerService.listBuyers).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(MEMBERSHIP);
	});

	it('narrows by a filter the resource declares', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactBuyers({ role: { eq: ContactBuyerRole.VIEWER } });

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP]);
		// The total is the filtered total, which is what the REST envelope reports as `total`.
		expect(connection.totalCount).toBe(1);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.contactBuyers(undefined, [{ field: 'assignedAt', direction: 'ASC' }]);

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP, MEMBERSHIP]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.contactBuyers(undefined, undefined, undefined, 1);

		const second = await resolver.contactBuyers(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactBuyers(undefined, [{ field: 'buyerCustomerId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contactBuyers({ isPrimary: { eq: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.contactBuyers(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every row', async () => {
		const { resolver } = surfaces();

		const error = await resolver.contactBuyers(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactBuyerResolver — one concept, two protocols, the same writes', () => {
	it('attaches and removes through the same service methods the REST routes call', async () => {
		const { resolver, contactBuyerService } = surfaces();

		await resolver.createContactBuyer({
			organizationId: ORGANIZATION,
			companyCustomerId: COMPANY,
			buyerCustomerId: BUYER,
			role: ContactBuyerRole.PURCHASER
		});
		await resolver.deleteContactBuyer(MEMBERSHIP);

		expect(contactBuyerService.addBuyer).toHaveBeenCalledWith(
			expect.objectContaining({ companyCustomerId: COMPANY, buyerCustomerId: BUYER })
		);
		expect(contactBuyerService.removeBuyer).toHaveBeenCalledWith(MEMBERSHIP);
	});

	it('surfaces the refusal of an individual account as a 4xx that is not a 404', async () => {
		const refusal = new BadRequestException(
			"COMPANY_ACCOUNT_REQUIRED: 'Ada' is an individual account, and a buyer list belongs to a company."
		);
		const contactBuyerService = {
			listBuyers: jest.fn().mockResolvedValue(ROWS),
			addBuyer: jest.fn().mockRejectedValue(refusal)
		};
		const resolver = new ContactBuyerResolver(contactBuyerService as never);

		const error = await resolver
			.createContactBuyer({ organizationId: ORGANIZATION, companyCustomerId: COMPANY, buyerCustomerId: BUYER })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('COMPANY_ACCOUNT_REQUIRED');
	});
});

describe('ContactBuyerResolver — the guard stack and the permission every root field declares', () => {
	it('guards the resolver with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactBuyerResolver) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the edit permission on every write', () => {
		const proto = ContactBuyerResolver.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['contactBuyers', PermissionsEnum.ORG_CONTACT_VIEW],
			['createContactBuyer', PermissionsEnum.ORG_CONTACT_EDIT],
			['deleteContactBuyer', PermissionsEnum.ORG_CONTACT_EDIT]
		];

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactBuyerResolver)).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);

		for (const [field, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[field])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ContactBuyerResolver.prototype;

		for (const field of ['createContactBuyer', 'deleteContactBuyer']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[field]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.ORG_CONTACT_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('offers no argument it cannot honour', () => {
		const printed = printSchema(schema);

		expect(printed).not.toMatch(/contactBuyers\([^)]*withDeleted/);
	});
});
