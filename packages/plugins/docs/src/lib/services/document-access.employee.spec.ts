const mockContext: { userId: string | null; jwtEmployeeId: string | null } = {
	userId: 'user-1',
	jwtEmployeeId: 'employee-of-org-a'
};

jest.mock('@gauzy/core', () => ({
	Employee: class Employee {},
	OrganizationTeamEmployee: class OrganizationTeamEmployee {},
	RolePermission: class RolePermission {},
	User: class User {},
	RequestContext: {
		currentUserId: () => mockContext.userId,
		currentUser: () => (mockContext.jwtEmployeeId ? { employeeId: mockContext.jwtEmployeeId } : null),
		hasPermission: () => false
	}
}));
jest.mock('../repositories/type-orm-document-share.repository', () => ({
	TypeOrmDocumentShareRepository: class TypeOrmDocumentShareRepository {}
}));

import { DocumentAccessService } from './document-access.service';

/** The access service over a stub employee table: user-1 is an employee of org-a and org-b (inactive in org-c). */
function buildService(lookupFails = false) {
	const employees = [
		{
			id: 'employee-of-org-a',
			userId: 'user-1',
			organizationId: 'org-a',
			tenantId: 'tenant-1',
			isActive: true,
			isArchived: false
		},
		{
			id: 'employee-of-org-b',
			userId: 'user-1',
			organizationId: 'org-b',
			tenantId: 'tenant-1',
			isActive: true,
			isArchived: false
		},
		{
			id: 'old-employee-of-org-c',
			userId: 'user-1',
			organizationId: 'org-c',
			tenantId: 'tenant-1',
			isActive: false,
			isArchived: false
		}
	];
	const softDeleted = [
		{
			id: 'deleted-employee-of-org-d',
			userId: 'user-1',
			organizationId: 'org-d',
			tenantId: 'tenant-1',
			isActive: false,
			isArchived: false
		}
	];
	const manager = {
		// A soft-deleted row is read only with `withDeleted`, as TypeORM does.
		find: jest.fn(
			async (_entity: unknown, { where, withDeleted }: { where: Record<string, unknown>; withDeleted?: boolean }) => {
				if (lookupFails) throw new Error('database unavailable');
				return [...employees, ...(withDeleted ? softDeleted : [])].filter((row) =>
					Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
				);
			}
		),
		findOne: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => {
			if (lookupFails) throw new Error('database unavailable');
			return (
				employees.find((row) =>
					Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
				) ?? null
			);
		})
	};
	return new DocumentAccessService({ manager } as never);
}

describe('DocumentAccessService.currentEmployeeIdIn', () => {
	afterEach(() => {
		mockContext.userId = 'user-1';
		mockContext.jwtEmployeeId = 'employee-of-org-a';
	});

	it("answers the user's employee in the page's organization, not the one in the token", async () => {
		await expect(buildService().currentEmployeeIdIn('org-b' as never, 'tenant-1' as never)).resolves.toBe(
			'employee-of-org-b'
		);
		await expect(buildService().currentEmployeeIdIn('org-a' as never, 'tenant-1' as never)).resolves.toBe(
			'employee-of-org-a'
		);
	});

	it('passes over an inactive employee and falls back to the token employee', async () => {
		await expect(buildService().currentEmployeeIdIn('org-c' as never, 'tenant-1' as never)).resolves.toBe(
			'employee-of-org-a'
		);
	});

	it('falls back to the token employee without a scope or a user', async () => {
		await expect(buildService().currentEmployeeIdIn(null, 'tenant-1' as never)).resolves.toBe('employee-of-org-a');
		mockContext.userId = null;
		await expect(buildService().currentEmployeeIdIn('org-b' as never, 'tenant-1' as never)).resolves.toBe(
			'employee-of-org-a'
		);
	});

	it('throws when the lookup fails, rather than acting as the token employee', async () => {
		await expect(buildService(true).currentEmployeeIdIn('org-b' as never, 'tenant-1' as never)).rejects.toThrow(
			'database unavailable'
		);
	});
});

describe('DocumentAccessService.currentUserEmployeeIdsIn', () => {
	afterEach(() => {
		mockContext.userId = 'user-1';
	});

	it('answers every employee of the user in the tenant, an inactive and a soft-deleted one included', async () => {
		await expect(buildService().currentUserEmployeeIdsIn('tenant-1' as never)).resolves.toEqual([
			'employee-of-org-a',
			'employee-of-org-b',
			'old-employee-of-org-c',
			'deleted-employee-of-org-d'
		]);
	});

	it('answers nothing without a user, and throws when the read fails', async () => {
		await expect(buildService(true).currentUserEmployeeIdsIn('tenant-1' as never)).rejects.toThrow('database unavailable');
		mockContext.userId = null;
		await expect(buildService().currentUserEmployeeIdsIn('tenant-1' as never)).resolves.toEqual([]);
	});
});
