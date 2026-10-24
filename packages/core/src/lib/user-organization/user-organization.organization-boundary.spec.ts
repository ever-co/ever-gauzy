import '../core/entities/internal';

import { ForbiddenException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { runOutsideOrganizationBoundary } from '../core/crud/organization-boundary';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { UserOrganizationDeleteHandler } from './commands/handlers/user-organization.delete.handler';
import { CreateUserOrganizationDTO, UpdateUserOrganizationDTO } from './dto';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganizationService } from './user-organization.services';

jest.mock('../core/utils', () => ({
	...jest.requireActual('../core/utils'),
	getORMType: () => 'typeorm'
}));

/**
 * Owner decision 1 (2026-10-22): a tenant admin (`SUPER_ADMIN`, `ADMIN`) reaches every organization of the tenant,
 * anyone else only the organization of their token. A membership is what grants an organization: once one exists,
 * `POST /auth/switch-organization` (open to every role) moves its user into it.
 *
 * `POST /user-organization` and `PUT /user-organization/:id` took the entity itself as their body, unvalidated, and
 * `UserOrganizationService` opts out of the CRUD base's boundary (memberships are READ across organizations by
 * design). A non-admin granted `ORG_USERS_EDIT` therefore added themselves to any organization of the tenant, or
 * reactivated their membership of one, and switched into it; the GraphQL twin checked the organization it names.
 *
 * Now the REST bodies are whitelisted to the GraphQL inputs, the organization a create names is checked as the
 * twin's is, and every write of a stored membership (update, withdraw, restore, delete) keeps a confined caller to
 * the memberships of their token's organization, on both surfaces.
 */

const TENANT = '7a000000-0000-4000-8000-000000000001';
const USER = '7a000000-0000-4000-8000-0000000000a1';
const OTHER_USER = '7a000000-0000-4000-8000-0000000000a2';
const OWN = '7a000000-0000-4000-8000-0000000000b1';
const SIBLING = '7a000000-0000-4000-8000-0000000000b2';
const FOREIGN = '7a000000-0000-4000-8000-0000000000b3';

const OWN_MEMBERSHIP = '7a000000-0000-4000-8000-0000000000c1';
const SIBLING_MEMBERSHIP = '7a000000-0000-4000-8000-0000000000c2';

/** Who is calling: a signed-in member of OWN by default, confined to it. */
const caller = {
	signedIn: true,
	role: RolesEnum.EMPLOYEE as RolesEnum,
	organizationId: OWN as string | null
};
const cls = new Map<string, unknown>();

beforeEach(() => {
	caller.signedIn = true;
	caller.role = RolesEnum.EMPLOYEE;
	caller.organizationId = OWN;
	cls.clear();

	jest.spyOn(RequestContext, 'currentUser').mockImplementation(() =>
		caller.signedIn ? ({ id: USER, tenantId: TENANT } as any) : null
	);
	jest.spyOn(RequestContext, 'currentUserId').mockImplementation(() => (caller.signedIn ? USER : null));
	jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => (caller.signedIn ? TENANT : null));
	jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(() => caller.organizationId);
	jest.spyOn(RequestContext, 'hasRoles').mockImplementation(
		(roles: RolesEnum[]) => caller.signedIn && roles.includes(caller.role)
	);
	// The request-scoped store `runOutsideOrganizationBoundary` counts its open blocks in.
	(RequestContext as any).clsService = {
		get: (key: string) => cls.get(key),
		set: (key: string, value: unknown) => cls.set(key, value)
	};
});

afterEach(() => {
	jest.restoreAllMocks();
	delete (RequestContext as any).clsService;
});

describe('POST/PUT /user-organization bodies', () => {
	/** The memberships the organization check finds: the caller belongs to OWN only. */
	const memberships = [{ tenantId: TENANT, userId: USER, organizationId: OWN }];

	beforeAll(() => {
		// class-validator instantiates a constraint with `new` unless a container resolves it; the constraint needs
		// its repositories, so resolve it over a scripted one.
		const typeOrmRepository = {
			findOneByOrFail: async (where: Record<string, unknown>) => {
				const match = memberships.find((row) =>
					Object.entries(where).every(([key, value]) => (row as any)[key] === value)
				);
				if (!match) {
					throw new Error('EntityNotFoundError');
				}
				return match;
			},
			manager: {
				count: async (_entity: unknown, { where }: { where: Record<string, unknown> }) =>
					where.tenantId === TENANT && [OWN, SIBLING].includes(where.id as string) ? 1 : 0
			}
		};
		useContainer(
			{
				get: (someClass: any) =>
					someClass === OrganizationBelongsToUserConstraint
						? new OrganizationBelongsToUserConstraint(typeOrmRepository as any, {} as any)
						: new someClass()
			},
			{ fallback: true, fallbackOnErrors: true }
		);
	});

	/** The body as the route's validation pipe hands it to the handler. */
	const throughPipe = (metatype: Function, body: Record<string, unknown>) =>
		new ValidationPipe({ whitelist: true }).transform(body, { type: 'body', metatype: metatype as any });

	it('validates and whitelists both routes through the pipe', () => {
		for (const route of ['create', 'update'] as const) {
			const pipes = Reflect.getMetadata('__pipes__', UserOrganizationController.prototype[route]) ?? [];
			expect(pipes).toHaveLength(1);
			expect(pipes[0]).toBeInstanceOf(ValidationPipe);
			expect((pipes[0] as any).validatorOptions).toEqual(expect.objectContaining({ whitelist: true }));
		}
	});

	it('accepts what the Users page sends for the organization of the caller’s token', async () => {
		await expect(
			throughPipe(CreateUserOrganizationDTO, {
				userId: OTHER_USER,
				organizationId: OWN,
				tenantId: TENANT,
				isActive: true
			})
		).resolves.toEqual({ userId: OTHER_USER, organizationId: OWN, tenantId: TENANT, isActive: true });
	});

	it('refuses a non-admin naming another organization of the tenant, or one of another tenant', async () => {
		for (const organizationId of [SIBLING, FOREIGN]) {
			await expect(
				throughPipe(CreateUserOrganizationDTO, { userId: USER, organizationId, tenantId: TENANT })
			).rejects.toThrow();
		}
	});

	it('lets a tenant admin name any organization of the tenant, and no other', async () => {
		caller.role = RolesEnum.ADMIN;

		await expect(
			throughPipe(CreateUserOrganizationDTO, { userId: OTHER_USER, organizationId: SIBLING })
		).resolves.toEqual({ userId: OTHER_USER, organizationId: SIBLING });
		await expect(
			throughPipe(CreateUserOrganizationDTO, { userId: OTHER_USER, organizationId: FOREIGN })
		).rejects.toThrow();
	});

	it('requires the person and the organization', async () => {
		await expect(throughPipe(CreateUserOrganizationDTO, { organizationId: OWN })).rejects.toThrow();
		await expect(throughPipe(CreateUserOrganizationDTO, { userId: USER })).rejects.toThrow();
	});

	it('drops every other column of the row from a create', async () => {
		await expect(
			throughPipe(CreateUserOrganizationDTO, {
				userId: OTHER_USER,
				organizationId: OWN,
				isDefault: false,
				id: OWN_MEMBERSHIP,
				deletedAt: null,
				isArchived: false,
				organization: { id: SIBLING },
				user: { id: USER, role: { name: RolesEnum.SUPER_ADMIN } }
			})
		).resolves.toEqual({ userId: OTHER_USER, organizationId: OWN, isDefault: false });
	});

	it('keeps only the flags in an update: a membership is never re-pointed', async () => {
		await expect(
			throughPipe(UpdateUserOrganizationDTO, {
				isActive: false,
				isDefault: true,
				userId: USER,
				organizationId: SIBLING,
				organization: { id: SIBLING },
				user: { id: USER },
				tenantId: TENANT
			})
		).resolves.toEqual({ isActive: false, isDefault: true });
	});
});

describe('UserOrganizationService writes keep a confined caller inside their organization', () => {
	/** Stored memberships, by id. */
	const stored: Record<string, { organizationId: string; userId: string }> = {
		[OWN_MEMBERSHIP]: { organizationId: OWN, userId: OTHER_USER },
		[SIBLING_MEMBERSHIP]: { organizationId: SIBLING, userId: USER }
	};

	let service: UserOrganizationService;
	let findOneByIdString: jest.Mock;
	let created: jest.SpyInstance;
	let updated: jest.SpyInstance;
	let softRemoved: jest.SpyInstance;
	let softRecovered: jest.SpyInstance;

	beforeEach(() => {
		created = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: any) => ({ id: 'membership-new', ...entity }) as never);
		updated = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never);
		softRemoved = jest
			.spyOn(CrudService.prototype, 'softRemove')
			.mockImplementation(async (id: any) => ({ id }) as never);
		softRecovered = jest
			.spyOn(CrudService.prototype, 'softRecover')
			.mockImplementation(async (id: any) => ({ id }) as never);

		findOneByIdString = jest.fn(async (id: string) => {
			if (!stored[id]) {
				throw new NotFoundException('The requested record was not found');
			}
			return { id, tenantId: TENANT, ...stored[id] };
		});
		service = Object.create(UserOrganizationService.prototype);
		Object.assign(service, { findOneByIdString });
	});

	describe('create', () => {
		it('adds a membership of the organization of the caller’s token', async () => {
			await service.create({ userId: OTHER_USER, organizationId: OWN });

			expect(created).toHaveBeenCalledWith({ userId: OTHER_USER, organizationId: OWN });
		});

		it('refuses a membership of another organization, however it is named', async () => {
			// The failure scenario: the caller adds themselves to a sibling organization, then switches into it.
			await expect(service.create({ userId: USER, organizationId: SIBLING })).rejects.toThrow(
				ForbiddenException
			);
			await expect(service.create({ userId: USER, organization: { id: SIBLING } } as any)).rejects.toThrow(
				ForbiddenException
			);
			await expect(service.create({ userId: USER })).rejects.toThrow(ForbiddenException);

			expect(created).not.toHaveBeenCalled();
		});

		it('refuses a caller whose token names no organization', async () => {
			caller.organizationId = null;

			await expect(service.create({ userId: USER, organizationId: OWN })).rejects.toThrow(ForbiddenException);
			expect(created).not.toHaveBeenCalled();
		});

		it('refuses an upsert onto a stored membership of another organization', async () => {
			await expect(
				service.create({ id: SIBLING_MEMBERSHIP, userId: USER, organizationId: OWN } as any)
			).rejects.toThrow(NotFoundException);

			expect(findOneByIdString).toHaveBeenCalledWith(SIBLING_MEMBERSHIP, { withDeleted: true });
			expect(created).not.toHaveBeenCalled();
		});

		it('lets a tenant admin add a membership of any organization of the tenant', async () => {
			caller.role = RolesEnum.ADMIN;

			await service.create({ userId: USER, organizationId: SIBLING });

			expect(created).toHaveBeenCalledWith({ userId: USER, organizationId: SIBLING });
		});

		it('lets a flow that crosses organizations by design add it (creating an organization)', async () => {
			// What OrganizationCreateHandler does for the admins of the organization it has just created.
			await runOutsideOrganizationBoundary(() =>
				service.create({ organization: { id: SIBLING }, user: { id: USER } } as any)
			);

			expect(created).toHaveBeenCalledWith({ organization: { id: SIBLING }, user: { id: USER } });
			// The crossing ends with the flow
			await expect(service.create({ userId: USER, organizationId: SIBLING })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('does not confine a call with no user in context (a job, a seed)', async () => {
			caller.signedIn = false;

			await service.create({ userId: USER, organizationId: SIBLING });

			expect(created).toHaveBeenCalledTimes(1);
		});
	});

	describe('update', () => {
		it('refuses a membership of another organization as one that does not exist', async () => {
			// The failure scenario: the caller reactivates their own membership of a sibling organization.
			await expect(service.update(SIBLING_MEMBERSHIP, { isActive: true })).rejects.toThrow(NotFoundException);

			expect(updated).not.toHaveBeenCalled();
		});

		it('changes a membership of the caller’s organization, and never moves it', async () => {
			await service.update(OWN_MEMBERSHIP, {
				isActive: false,
				organizationId: SIBLING,
				organization: { id: SIBLING },
				userId: USER,
				user: { id: USER }
			} as any);

			expect(updated).toHaveBeenCalledWith(OWN_MEMBERSHIP, { isActive: false });
		});

		it('keeps criteria from code to the caller’s organization', async () => {
			await service.update({ userId: OTHER_USER } as any, { isDefault: false });

			expect(updated).toHaveBeenCalledWith({ userId: OTHER_USER, organizationId: OWN }, { isDefault: false });
		});

		it('narrows criteria that name an organization: another organization writes nothing', async () => {
			// Replacing it turned `{ userId, organizationId: SIBLING }` into the user's membership of OWN, and a bare
			// `{ organizationId: SIBLING }` into every membership of OWN.
			for (const criteria of [
				{ userId: USER, organizationId: SIBLING },
				{ organizationId: SIBLING },
				{ userId: USER, organization: { id: SIBLING } }
			]) {
				await expect(service.update(criteria as any, { isActive: false })).rejects.toThrow(NotFoundException);
			}

			expect(updated).not.toHaveBeenCalled();
		});

		it('keeps criteria that name the caller’s own organization', async () => {
			await service.update({ userId: OTHER_USER, organizationId: OWN } as any, { isDefault: false });

			expect(updated).toHaveBeenCalledWith({ userId: OTHER_USER, organizationId: OWN }, { isDefault: false });
		});

		it('leaves a membership that does not exist to the update, which answers it as before', async () => {
			await service.update('7a000000-0000-4000-8000-0000000000ff', { isActive: true });

			expect(updated).toHaveBeenCalledWith('7a000000-0000-4000-8000-0000000000ff', { isActive: true });
		});

		it('lets a tenant admin change any membership of the tenant, as before', async () => {
			caller.role = RolesEnum.SUPER_ADMIN;

			await service.update(SIBLING_MEMBERSHIP, { isActive: true });

			expect(updated).toHaveBeenCalledWith(SIBLING_MEMBERSHIP, { isActive: true });
			expect(findOneByIdString).not.toHaveBeenCalled();
		});
	});

	describe('withdraw and restore', () => {
		it('refuses a membership of another organization', async () => {
			await expect(service.softRemove(SIBLING_MEMBERSHIP)).rejects.toThrow(NotFoundException);
			await expect(service.softRecover(SIBLING_MEMBERSHIP)).rejects.toThrow(NotFoundException);

			// A restore looks among withdrawn memberships, the one it restores among them
			expect(findOneByIdString).toHaveBeenCalledWith(SIBLING_MEMBERSHIP, { withDeleted: true });
			expect(softRemoved).not.toHaveBeenCalled();
			expect(softRecovered).not.toHaveBeenCalled();
		});

		it('withdraws and restores a membership of the caller’s organization', async () => {
			await service.softRemove(OWN_MEMBERSHIP);
			await service.softRecover(OWN_MEMBERSHIP);

			expect(softRemoved).toHaveBeenCalledWith(OWN_MEMBERSHIP, undefined, undefined);
			expect(softRecovered).toHaveBeenCalledWith(OWN_MEMBERSHIP, undefined, undefined);
		});

		it('lets a tenant admin withdraw and restore any membership of the tenant', async () => {
			caller.role = RolesEnum.ADMIN;

			await service.softRemove(SIBLING_MEMBERSHIP);
			await service.softRecover(SIBLING_MEMBERSHIP);

			expect(softRemoved).toHaveBeenCalledTimes(1);
			expect(softRecovered).toHaveBeenCalledTimes(1);
		});
	});
});

describe('UserOrganizationDeleteHandler keeps a confined caller inside their organization', () => {
	const membershipOf = (organizationId: string) => ({
		id: 'membership-1',
		organizationId,
		userId: OTHER_USER,
		user: { email: 'colleague@example.com', role: { name: RolesEnum.EMPLOYEE } }
	});

	/** The handler over a membership of the given organization, the user belonging to two organizations. */
	function harness(organizationId: string) {
		const userOrganizationService = {
			findOneByIdString: jest.fn().mockResolvedValue(membershipOf(organizationId)),
			isMembershipWithinBoundary: UserOrganizationService.prototype.isMembershipWithinBoundary,
			countBy: jest.fn().mockResolvedValue(2),
			delete: jest.fn().mockResolvedValue({ affected: 1 })
		};
		const userService = { delete: jest.fn(), countBy: jest.fn() };
		const roleService = { findOneByIdString: jest.fn() };
		const handler = new UserOrganizationDeleteHandler(
			userOrganizationService as any,
			userService as any,
			roleService as any
		);
		return { handler, userOrganizationService, userService };
	}

	it('refuses to remove a membership of another organization (or the account behind it)', async () => {
		const { handler, userOrganizationService, userService } = harness(SIBLING);

		await expect(handler.execute({ userOrganizationId: 'membership-1' } as any)).rejects.toThrow(
			NotFoundException
		);

		expect(userOrganizationService.delete).not.toHaveBeenCalled();
		expect(userService.delete).not.toHaveBeenCalled();
	});

	it('removes a membership of the caller’s organization, as before', async () => {
		const { handler, userOrganizationService } = harness(OWN);

		await handler.execute({ userOrganizationId: 'membership-1' } as any);

		expect(userOrganizationService.delete).toHaveBeenCalledWith('membership-1');
	});

	it('lets a tenant admin remove a membership of any organization of the tenant, as before', async () => {
		caller.role = RolesEnum.ADMIN;
		const { handler, userOrganizationService } = harness(SIBLING);

		await handler.execute({ userOrganizationId: 'membership-1' } as any);

		expect(userOrganizationService.delete).toHaveBeenCalledWith('membership-1');
	});
});
