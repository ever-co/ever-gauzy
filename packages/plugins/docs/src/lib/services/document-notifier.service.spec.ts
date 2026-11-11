const mockConfig = { collabEnabled: true };
const mockActor = { employeeId: 'actor-employee', firstName: 'Ada', lastName: 'Lovelace' };

jest.mock('@gauzy/core', () => ({
	Employee: class Employee {},
	EmployeeNotification: class EmployeeNotification {},
	OrganizationTeamEmployee: class OrganizationTeamEmployee {},
	EmployeeCreateNotificationEvent: class EmployeeCreateNotificationEvent {
		constructor(public readonly input: Record<string, unknown>) {}
	},
	RequestContext: { currentUser: () => mockActor, currentUserId: () => 'actor-user', currentEmployeeId: () => mockActor.employeeId }
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => mockConfig }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class TypeOrmDocumentRepository {} }));

import { DocumentReviewStatusEnum, DocumentShareAccessEnum } from '@gauzy/contracts';
import { DocumentNotifierService } from './document-notifier.service';

const DOCUMENT = { id: 'page-1', name: 'Plan', tenantId: 'tenant-1', organizationId: 'org-1', createdByUserId: 'creator-user', metadata: null } as never;

/**
 * The notifier over an in-memory notification table: every published notification becomes a row the next
 * `recentlyNotified` read sees, as the platform's `EmployeeCreateNotificationEvent` handler would file it.
 */
function buildNotifier() {
	const rows: Array<Record<string, unknown>> = [];
	const published: Array<Record<string, unknown>> = [];
	const manager = {
		find: jest.fn(async (_entity: unknown, options: { where: Record<string, unknown> }) => {
			const { where } = options;
			// A user's employees in the tenant.
			if (where['userId'] === 'creator-user') {
				return [
					{ id: 'creator-employee', isActive: true, isArchived: false },
					{ id: 'creator-employee-elsewhere', isActive: true, isArchived: false }
				];
			}
			if (where['userId'] === 'creator-without-org-employee') {
				return [
					{ id: 'creator-old-employee', isActive: false, isArchived: false },
					{ id: 'creator-archived-employee', isActive: true, isArchived: true },
					{ id: 'creator-active-employee', isActive: true, isArchived: false }
				];
			}
			if (where['userId']) return [];
			const receivers = new Set(((where['receiverEmployeeId'] as { value?: unknown[] })?.value ?? []).map(String));
			return rows.filter((row) => row['entityId'] === where['entityId'] && row['type'] === where['type'] && row['message'] === where['message'] && receivers.has(String(row['receiverEmployeeId'])));
		}),
		// Each user's employee in the page's organization.
		findOne: jest.fn(async (_entity: unknown, options: { where: Record<string, unknown> }) => {
			const { userId } = options.where;
			if (userId === 'actor-user') return { id: 'actor-employee' };
			if (userId === 'creator-user') return { id: 'creator-employee' };
			return null;
		})
	};
	const eventBus = {
		publish: jest.fn((event: { input: Record<string, unknown> }) => {
			published.push(event.input);
			rows.push({ ...event.input, createdAt: new Date() });
		})
	};
	const notifier = new DocumentNotifierService({ manager } as never, eventBus as never);
	return { notifier, published, manager };
}

describe('DocumentNotifierService', () => {
	it('files every review request as an entry of its own, even a second one within the dedupe window', async () => {
		const { notifier, published } = buildNotifier();
		expect(await notifier.notifyReviewRequested(DOCUMENT, ['reviewer'], 'first round')).toBe(1);
		// The reviewer approved the first round; a new request for the same page follows a few minutes later.
		expect(await notifier.notifyReviewRequested(DOCUMENT, ['reviewer'], 'second round')).toBe(1);
		expect(published.map((entry) => entry['receiverEmployeeId'])).toEqual(['reviewer', 'reviewer']);
		expect(published.map((entry) => entry['message'])).toEqual(['Review requested', 'Review requested']);
	});

	it('files every review decision as an entry of its own, even a second one within the dedupe window', async () => {
		const { notifier, published } = buildNotifier();
		expect(await notifier.notifyReviewDecided(DOCUMENT, DocumentReviewStatusEnum.APPROVED, null)).toBe(1);
		expect(await notifier.notifyReviewDecided(DOCUMENT, DocumentReviewStatusEnum.APPROVED, 'again')).toBe(1);
		expect(await notifier.notifyReviewDecided(DOCUMENT, DocumentReviewStatusEnum.REJECTED, null)).toBe(1);
		expect(published.map((entry) => entry['message'])).toEqual(['Review approved', 'Review approved', 'Review rejected']);
		expect(published.every((entry) => entry['receiverEmployeeId'] === 'creator-employee')).toBe(true);
	});

	it('keeps the dedupe window for a repeated share of the same page with the same person', async () => {
		const { notifier, published } = buildNotifier();
		expect(await notifier.notifyShared(DOCUMENT, { employeeId: 'colleague' as never, teamId: null }, DocumentShareAccessEnum.COMMENT)).toBe(1);
		expect(await notifier.notifyShared(DOCUMENT, { employeeId: 'colleague' as never, teamId: null }, DocumentShareAccessEnum.EDIT)).toBe(0);
		expect(published).toHaveLength(1);
		// Someone else is still told.
		expect(await notifier.notifyShared(DOCUMENT, { employeeId: 'other' as never, teamId: null }, DocumentShareAccessEnum.VIEW)).toBe(1);
	});

	it('never tells the actor, and sends nothing while the collaboration feature is off', async () => {
		const { notifier, published } = buildNotifier();
		expect(await notifier.notifyReviewRequested(DOCUMENT, ['actor-employee'], null)).toBe(0);
		mockConfig.collabEnabled = false;
		try {
			expect(await notifier.notifyReviewRequested(DOCUMENT, ['reviewer'], null)).toBe(0);
		} finally {
			mockConfig.collabEnabled = true;
		}
		expect(published).toHaveLength(0);
	});

	it('tells the creator as the employee of the page organization, active and unarchived', async () => {
		const { notifier, published, manager } = buildNotifier();

		expect(await notifier.notifyReviewDecided(DOCUMENT, DocumentReviewStatusEnum.APPROVED, null)).toBe(1);

		expect(published[0]['receiverEmployeeId']).toBe('creator-employee');
		expect(manager.findOne).toHaveBeenCalledWith(expect.anything(), {
			select: { id: true },
			where: { userId: 'creator-user', organizationId: 'org-1', tenantId: 'tenant-1', isActive: true, isArchived: false }
		});
	});

	it('tells the creator nothing when a mute of the page is held by another of their employees', async () => {
		const { notifier, published } = buildNotifier();
		const muted = { ...(DOCUMENT as object), metadata: { collaboration: { mutedEmployeeIds: ['creator-employee-elsewhere'] } } } as never;

		expect(await notifier.notifyReviewDecided(muted, DocumentReviewStatusEnum.REJECTED, null)).toBe(0);
		expect(published).toHaveLength(0);
	});

	it('falls back to an active, unarchived employee of the creator elsewhere in the tenant', async () => {
		const { notifier, published } = buildNotifier();
		const elsewhere = { ...(DOCUMENT as object), createdByUserId: 'creator-without-org-employee' } as never;

		expect(await notifier.notifyReviewDecided(elsewhere, DocumentReviewStatusEnum.APPROVED, null)).toBe(1);
		expect(published[0]['receiverEmployeeId']).toBe('creator-active-employee');
	});

	it('leaves the actor out by their employee in the page organization, not only the one in their token', async () => {
		const { notifier, published } = buildNotifier();
		mockActor.employeeId = 'actor-employee-of-another-organization';
		try {
			expect(await notifier.notifyReviewRequested(DOCUMENT, ['actor-employee', 'reviewer'], 'please')).toBe(1);
			expect(published.map((entry) => entry['receiverEmployeeId'])).toEqual(['reviewer']);
		} finally {
			mockActor.employeeId = 'actor-employee';
		}
	});
});
