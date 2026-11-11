const mockConfig = { collabEnabled: true };
const mockActor = { employeeId: 'actor-employee', firstName: 'Ada', lastName: 'Lovelace' };

jest.mock('@gauzy/core', () => ({
	Employee: class Employee {},
	EmployeeNotification: class EmployeeNotification {},
	OrganizationTeamEmployee: class OrganizationTeamEmployee {},
	EmployeeCreateNotificationEvent: class EmployeeCreateNotificationEvent {
		constructor(public readonly input: Record<string, unknown>) {}
	},
	RequestContext: { currentUser: () => mockActor, currentEmployeeId: () => mockActor.employeeId }
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
			const receivers = new Set(((where['receiverEmployeeId'] as { value?: unknown[] })?.value ?? []).map(String));
			return rows.filter((row) => row['entityId'] === where['entityId'] && row['type'] === where['type'] && row['message'] === where['message'] && receivers.has(String(row['receiverEmployeeId'])));
		}),
		findOne: jest.fn(async () => ({ id: 'creator-employee' }))
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
});
