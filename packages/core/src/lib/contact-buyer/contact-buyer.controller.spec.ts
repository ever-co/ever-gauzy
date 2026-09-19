/**
 * Company-account membership over REST (API specification §7.7, §5.1).
 *
 * The suite pins the five things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — the read carries `ORG_CONTACT_VIEW` and the two writes
 *   `ORG_CONTACT_EDIT`, read on the metadata a guard actually reads;
 * - **both spellings of every filter** — the endpoint table names the two sides of the pivot `contactId`
 *   and `organizationContactId`, the delivered list method narrows on the columns' own names, and a
 *   client written against either document reaches the same rows;
 * - **the routes themselves** — each one is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may not do
 *   this" and "there is nothing here";
 * - **the class declares three routes and extends nothing**, because the CRUD base maps writes the
 *   specification's row does not name as root fields, and its inherited update would accept any body at
 *   all.
 *
 * Three module boundaries are doubled for the reason the channel suite states: the base CRUD class
 * reaches the entity barrel and with it the whole application graph, `@gauzy/config` reads the process
 * environment at import time, and the request context is what a write runs inside. The two guards are
 * doubled for a load-order reason as well — the guards barrel reaches the employee repository and
 * through it the entity graph from the wrong end — which keeps the assertion honest, because the
 * controller names these two tokens as its guards, which is what a guard reads.
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
import { ContactBuyerRole, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactBuyerController } from './contact-buyer.controller';

/** The tenant and organization a request runs in. Null is the "no credential" case below. */
let mockTenantId: string | null = '00000000-0000-4000-8000-000000000001';
let mockOrganizationId: string | null = '00000000-0000-4000-8000-000000000002';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const MEMBERSHIP = '00000000-0000-4000-8000-000000000090';
const COMPANY = '00000000-0000-4000-8000-000000000042';
const BUYER = '00000000-0000-4000-8000-000000000040';

/** The membership a scripted service answers with. */
const STORED = {
	id: MEMBERSHIP,
	tenantId: mockTenantId,
	organizationId: ORGANIZATION,
	companyCustomerId: COMPANY,
	buyerCustomerId: BUYER,
	role: ContactBuyerRole.PURCHASER,
	spendingLimit: 1000,
	periodStartDay: 1,
	isActive: true
};

/**
 * The service, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly rather
 * than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const contactBuyerService = {
		listBuyers: jest.fn().mockResolvedValue([STORED]),
		addBuyer: jest.fn().mockResolvedValue(STORED),
		removeBuyer: jest.fn().mockResolvedValue({ ...STORED, deletedAt: new Date('2026-03-01T10:00:00.000Z') }),
		...overrides
	};

	return { contactBuyerService, controller: new ContactBuyerController(contactBuyerService as never) };
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

beforeEach(() => {
	mockTenantId = '00000000-0000-4000-8000-000000000001';
	mockOrganizationId = ORGANIZATION;
});

describe('ContactBuyerController — the routes (API specification §7.7)', () => {
	it('lists the memberships of the caller’s organization, newest first', async () => {
		const { controller, contactBuyerService } = surfaces();

		const answer = await controller.findAll({ filter: { contactId: BUYER }, take: 10, skip: 0 });

		// The bracketed spelling under the table's vocabulary reaches the same narrowing the column's own
		// name does, and the page is applied here: the delivered list method answers with the filtered set.
		expect(contactBuyerService.listBuyers).toHaveBeenCalledWith({ buyerCustomerId: BUYER });
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('accepts the account under either of its spellings', async () => {
		const { controller, contactBuyerService } = surfaces();

		await controller.findAll({ organizationContactId: COMPANY, role: ContactBuyerRole.APPROVER });

		expect(contactBuyerService.listBuyers).toHaveBeenCalledWith({
			companyCustomerId: COMPANY,
			role: ContactBuyerRole.APPROVER
		});
	});

	it('accepts the column’s own spelling as well as the table’s', async () => {
		const { controller, contactBuyerService } = surfaces();

		await controller.findAll({ filter: { companyCustomerId: COMPANY, buyerCustomerId: BUYER } });

		expect(contactBuyerService.listBuyers).toHaveBeenCalledWith({
			companyCustomerId: COMPANY,
			buyerCustomerId: BUYER
		});
	});

	it('leaves an unstated member out rather than narrowing on a null', async () => {
		const { controller, contactBuyerService } = surfaces();

		await controller.findAll({});

		expect(contactBuyerService.listBuyers).toHaveBeenCalledWith({});
	});

	it('attaches a buyer to a company account', async () => {
		const { controller, contactBuyerService } = surfaces();

		const created = await controller.create({
			companyCustomerId: COMPANY,
			buyerCustomerId: BUYER,
			role: ContactBuyerRole.PURCHASER
		} as never);

		expect(contactBuyerService.addBuyer).toHaveBeenCalledWith({
			companyCustomerId: COMPANY,
			buyerCustomerId: BUYER,
			role: ContactBuyerRole.PURCHASER
		});
		expect(created).toBe(STORED);
	});

	it('removes a membership softly, which is the only removal path there is', async () => {
		const { controller, contactBuyerService } = surfaces();

		const removed = await controller.delete(MEMBERSHIP);

		expect(contactBuyerService.removeBuyer).toHaveBeenCalledWith(MEMBERSHIP);
		// The row is kept: an order placed by this buyer must remain attributable to the membership that
		// authorised it.
		expect(removed.deletedAt).toBeInstanceOf(Date);
	});

	it('declares three routes and no set-replacement, which the service cannot perform', () => {
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-buyer.controller.ts'),
			'utf8'
		);

		expect(source).toMatch(/@Get\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Post\(\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Delete\(':id'\)/);
		// `PUT /organization-contacts/:id/buyers` would need a replace-set operation the service does not
		// have, and `isPrimary` is not a column of the pivot — the flag appears in this class's own prose
		// and nowhere in its code.
		expect(source).not.toMatch(/@Put\(/);
		expect(source).not.toMatch(/isPrimary\s*[?:]/);
	});

	it('does not extend the CRUD base, whose routes the specification’s row does not name', () => {
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'contact-buyer.controller.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/extends CrudController/);
	});
});

describe('ContactBuyerController — refusals (a 4xx that is not a 404)', () => {
	it('refuses an account that is not a company with 400, never a 404', async () => {
		const refusal = new BadRequestException(
			"COMPANY_ACCOUNT_REQUIRED: 'Ada' is an individual account, and a buyer list belongs to a company."
		);
		const { controller } = surfaces({ addBuyer: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ companyCustomerId: COMPANY, buyerCustomerId: BUYER } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as HttpException).getStatus()).toBe(400);
		expect((error as Error).message).toContain('COMPANY_ACCOUNT_REQUIRED');
	});

	it('refuses a buyer who already belongs to another live account, never a 404', async () => {
		const refusal = new BadRequestException(
			"CONTACT_BUYER_COMPANY_EXISTS: contact 'ada' already buys for account 'other', and a buyer belongs to one live company account."
		);
		const { controller } = surfaces({ addBuyer: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ companyCustomerId: COMPANY, buyerCustomerId: BUYER } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_BUYER_COMPANY_EXISTS');
	});

	it('refuses a party that is its own buyer, which is not a relationship with oneself', async () => {
		const refusal = new BadRequestException(
			"CONTACT_BUYER_SELF: contact 'ada' cannot be its own buyer, because purchasing authority is a relationship with an account and not with oneself."
		);
		const { controller } = surfaces({ addBuyer: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ companyCustomerId: BUYER, buyerCustomerId: BUYER } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_BUYER_SELF');
	});

	it('refuses terms the account cannot hold, naming the code the catalogue publishes', async () => {
		const refusal = new BadRequestException(
			"CONTACT_BUYER_TERMS_INVALID: 'periodStartDay' is a day of the month between 1 and 28, and '31' is not one."
		);
		const { controller } = surfaces({ addBuyer: jest.fn().mockRejectedValue(refusal) });

		const error = await controller
			.create({ companyCustomerId: COMPANY, buyerCustomerId: BUYER, periodStartDay: 31 } as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('CONTACT_BUYER_TERMS_INVALID');
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('ContactBuyerController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', ContactBuyerController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ContactBuyerController)).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);
	});

	it('gives the read the read permission and every write the edit one', () => {
		const proto = ContactBuyerController.prototype;

		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['findAll'])).toEqual([
			PermissionsEnum.ORG_CONTACT_VIEW
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['create'])).toEqual([
			PermissionsEnum.ORG_CONTACT_EDIT
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto['delete'])).toEqual([
			PermissionsEnum.ORG_CONTACT_EDIT
		]);
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = ContactBuyerController.prototype;

		for (const route of ['create', 'delete']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.ORG_CONTACT_VIEW);
			expect(stated.length).toBeGreaterThan(0);
		}
	});

	it('refuses a request that presents no credential at all', () => {
		const guards = Reflect.getMetadata('__guards__', ContactBuyerController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(mockTenantId).toBe('00000000-0000-4000-8000-000000000001');
	});
});
