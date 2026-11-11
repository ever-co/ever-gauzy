const mockConfig = { collabEnabled: true };

jest.mock('@gauzy/config', () => ({ isSqlite: () => true, isBetterSqlite3: () => false }));
jest.mock('@gauzy/core', () => ({
	CreateEntitySubscriptionEvent: class CreateEntitySubscriptionEvent {
		constructor(public readonly input: Record<string, unknown>) {}
	},
	EntitySubscription: class EntitySubscription {},
	OrganizationTeam: class OrganizationTeam {},
	OrganizationTeamEmployee: class OrganizationTeamEmployee {},
	RequestContext: { currentTenantId: () => 'tenant-1', hasPermission: () => false },
	prepareSQLQuery: (query: string) => query
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => mockConfig }));
jest.mock('../entities/document.entity', () => ({ Document: class Document {} }));
jest.mock('../dto/document-space.dto', () => ({ MoveDocumentSpaceDTO: class MoveDocumentSpaceDTO {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({
	TypeOrmDocumentRepository: class TypeOrmDocumentRepository {}
}));
jest.mock('./document-access.predicate', () => ({ canAdministerShares: () => false }));
jest.mock('./document-access.service', () => ({ DocumentAccessService: class DocumentAccessService {} }));
jest.mock('./document-tree.service', () => ({ DocumentTreeService: class DocumentTreeService {} }));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));

import { DocumentCollaborationService } from './document-collaboration.service';

const PAGE_EMPLOYEE = 'employee-of-page-org';
const TOKEN_EMPLOYEE = 'employee-in-token';

interface Setup {
	subscriptions?: string[];
	muted?: string[];
	lookupFails?: boolean;
}

/**
 * The collaboration service for a user employed in two organizations: the page's organization knows them as
 * PAGE_EMPLOYEE, their token carries TOKEN_EMPLOYEE (the identity follows and mutes were saved under before).
 */
function build({ subscriptions = [], muted = [], lookupFails = false }: Setup = {}) {
	const document = {
		id: 'page-1',
		tenantId: 'tenant-1',
		organizationId: 'org-b',
		metadata: { collaboration: { mutedEmployeeIds: [...muted] } } as Record<string, unknown>
	};
	const rows = subscriptions.map((employeeId) => ({ employeeId }));
	const named = (where: Record<string, unknown>): Set<string> => {
		const value = where['employeeId'] as { value?: unknown[] } | string;
		return new Set((typeof value === 'object' && value?.value ? value.value : [value]).map(String));
	};
	const manager = {
		count: jest.fn(async (_entity: unknown, { where }: { where: Record<string, unknown> }) => {
			const ids = named(where);
			return rows.filter((row) => ids.has(row.employeeId)).length;
		}),
		delete: jest.fn(async (_entity: unknown, where: Record<string, unknown>) => {
			const ids = named(where);
			for (let index = rows.length - 1; index >= 0; index -= 1) {
				if (ids.has(rows[index].employeeId)) rows.splice(index, 1);
			}
		}),
		transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) =>
			work({
				findOne: async () => ({ id: document.id, metadata: document.metadata }),
				update: async () => undefined
			})
		)
	};
	const eventBus = {
		publish: jest.fn((event: { input: { employeeId: string } }) => rows.push({ employeeId: event.input.employeeId }))
	};
	const documentService = { findOneScoped: jest.fn(async () => document) };
	const access = {
		currentEmployeeIdIn: jest.fn(async () => {
			if (lookupFails) throw new Error('database unavailable');
			return PAGE_EMPLOYEE;
		}),
		currentEmployeeId: () => TOKEN_EMPLOYEE
	};
	const service = new DocumentCollaborationService(
		{ manager } as never,
		documentService as never,
		access as never,
		{} as never,
		eventBus as never
	);
	const mutedIds = () => (document.metadata['collaboration'] as { mutedEmployeeIds: string[] }).mutedEmployeeIds;
	return { service, rows, eventBus, mutedIds };
}

describe('DocumentCollaborationService follows across the identity change', () => {
	it('reads a follow saved under the employee in the token', async () => {
		const { service } = build({ subscriptions: [TOKEN_EMPLOYEE] });

		await expect(service.followState('page-1' as never)).resolves.toEqual({ following: true, muted: false });
	});

	it('reads a mute saved under the employee in the token, and an unmute clears it', async () => {
		const { service, mutedIds } = build({ muted: [TOKEN_EMPLOYEE] });

		await expect(service.followState('page-1' as never)).resolves.toEqual({ following: false, muted: true });
		await expect(service.unmute('page-1' as never)).resolves.toEqual({ following: false, muted: false });
		expect(mutedIds()).toEqual([]);
	});

	it('unfollows a follow saved under either employee', async () => {
		const { service, rows } = build({ subscriptions: [TOKEN_EMPLOYEE, PAGE_EMPLOYEE] });

		await expect(service.unfollow('page-1' as never)).resolves.toEqual({ following: false, muted: false });
		expect(rows).toEqual([]);
	});

	it('follows as the page organization employee and lifts a mute saved under the token employee', async () => {
		const { service, eventBus, mutedIds } = build({ muted: [TOKEN_EMPLOYEE] });

		await expect(service.follow('page-1' as never)).resolves.toEqual({ following: true, muted: false });
		expect(eventBus.publish).toHaveBeenCalledTimes(1);
		expect(eventBus.publish.mock.calls[0][0].input.employeeId).toBe(PAGE_EMPLOYEE);
		expect(mutedIds()).toEqual([]);
	});

	it('mutes as the page organization employee and drops the follows of both', async () => {
		const { service, rows, mutedIds } = build({ subscriptions: [TOKEN_EMPLOYEE, PAGE_EMPLOYEE] });

		await expect(service.mute('page-1' as never)).resolves.toEqual({ following: false, muted: true });
		expect(rows).toEqual([]);
		expect(mutedIds()).toEqual([PAGE_EMPLOYEE]);
	});

	it('fails the call, changing nothing, when the employee lookup fails', async () => {
		const { service, rows, eventBus, mutedIds } = build({ subscriptions: [TOKEN_EMPLOYEE], lookupFails: true });

		await expect(service.follow('page-1' as never)).rejects.toThrow('database unavailable');
		await expect(service.mute('page-1' as never)).rejects.toThrow('database unavailable');
		expect(eventBus.publish).not.toHaveBeenCalled();
		expect(rows).toEqual([{ employeeId: TOKEN_EMPLOYEE }]);
		expect(mutedIds()).toEqual([]);
	});
});
