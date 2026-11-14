// Must stay first: the entities barrel resolves the circular entity imports.
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	IInvoice,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { Employee } from '../../core/entities/internal';
import { EmployeeCreateNotificationEvent } from '../../employee-notification/events/employee-notification.event';
import { EstimateAnswerContextUnavailableError } from './estimate-answer-context';
import { EstimateAnswerNotifier } from './estimate-answer-notifier.service';
import { IEstimateAnswer } from './estimate-answered.event';

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

/** The estimate as the notifier reads it. */
const estimate = (overrides: Partial<IInvoice> = {}): IInvoice =>
	({
		id: 'estimate-1',
		invoiceNumber: 12,
		totalValue: 1250,
		currency: 'EUR',
		isEstimate: true,
		organizationId: ORGANIZATION,
		tenantId: TENANT,
		toContact: { id: 'contact-1', name: 'Acme Corp' },
		organization: { id: ORGANIZATION, name: 'Ever Org' },
		createdByUser: { id: 'user-creator', email: 'creator@org.test', isActive: true, preferredLanguage: 'bg' },
		...overrides
	}) as IInvoice;

const accepted: IEstimateAnswer = {
	invoiceId: 'estimate-1',
	tenantId: TENANT,
	isAccepted: true,
	answeredFrom: 'billing@acme.test'
};

describe('EstimateAnswerNotifier', () => {
	const savedEnv = { ...process.env };
	const originalClsService = RequestContext['clsService'];

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));

	function setup(stored: IInvoice | null, handlers: { id: string; userId: string }[]) {
		const repository = {
			// Answers the stored document only where every condition of the read holds for it, as the database would
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
				const row = stored as unknown as Record<string, unknown> | null;
				return row && Object.entries(where).every(([key, value]) => row[key] === value) ? stored : null;
			}),
			manager: { find: jest.fn(async () => handlers) }
		};
		const emailService = { sendEstimateAnswered: jest.fn(async () => undefined) };
		const eventBus = { publish: jest.fn() };
		const notifier = new EstimateAnswerNotifier(repository as never, emailService as never, eventBus as never);
		return { notifier, repository, emailService, eventBus };
	}

	const published = (eventBus: { publish: jest.Mock }) =>
		eventBus.publish.mock.calls.map(([event]) => (event as EmployeeCreateNotificationEvent).input);

	beforeEach(() => {
		delete process.env.GAUZY_INBOX_ENABLED;
		delete process.env.GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED;
	});

	afterAll(() => {
		process.env = savedEnv;
		RequestContext.setClsService(originalClsService);
	});

	/** Who the request context says is signed in, as a step of the notifier reads it. */
	const signedIn = () => ({
		tenantId: RequestContext.currentTenantId(),
		organizationId: RequestContext.currentOrganizationId(),
		userId: RequestContext.currentUserId(),
		employeeId: RequestContext.currentEmployeeId()
	});

	it('gives every invoice handler of the organization an Invoice notification about the estimate', async () => {
		const handlers = [
			{ id: 'employee-1', userId: 'user-creator' },
			{ id: 'employee-2', userId: 'user-accountant' }
		];
		const { notifier, eventBus } = setup(estimate(), handlers);

		await notifier.notify(accepted);

		expect(eventBus.publish).toHaveBeenCalledWith(expect.any(EmployeeCreateNotificationEvent));
		expect(published(eventBus)).toEqual(
			['employee-1', 'employee-2'].map((receiverEmployeeId) => ({
				title: 'Acme Corp accepted estimate #12',
				message: 'Total: 1,250.00 EUR. Answered from billing@acme.test. You can now turn it into an invoice.',
				type: EmployeeNotificationTypeEnum.INVOICE,
				entity: BaseEntityEnum.Invoice,
				entityId: 'estimate-1',
				receiverEmployeeId,
				organizationId: ORGANIZATION,
				tenantId: TENANT
			}))
		);
	});

	it("tells the team as nobody of the estimate's tenant and organization, the answer coming with nobody signed in", async () => {
		const { notifier, eventBus, emailService } = setup(estimate(), [{ id: 'employee-1', userId: 'user-1' }]);
		const seen: Record<string, unknown>[] = [];
		eventBus.publish.mockImplementation(() => seen.push(signedIn()));
		emailService.sendEstimateAnswered.mockImplementation(async () => {
			seen.push(signedIn());
		});
		const publicRequest = { headers: {}, query: {}, params: {}, body: {} };

		await RequestContext.runWithRequest(publicRequest as never, () => notifier.notify(accepted));

		const nobodyOfTheTenant = { tenantId: TENANT, organizationId: ORGANIZATION, userId: null, employeeId: null };
		expect(seen).toEqual([nobodyOfTheTenant, nobodyOfTheTenant]);
	});

	it('tells nobody when it cannot open a request context of the tenant, rather than file the notices without one', async () => {
		const { notifier, eventBus, emailService } = setup(estimate(), [{ id: 'employee-1', userId: 'user-1' }]);
		RequestContext.setClsService(undefined as never);
		try {
			await expect(notifier.notify(accepted)).rejects.toBeInstanceOf(EstimateAnswerContextUnavailableError);
		} finally {
			RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		}

		expect(eventBus.publish).not.toHaveBeenCalled();
		expect(emailService.sendEstimateAnswered).not.toHaveBeenCalled();
	});

	it('asks for the active employees of its organization whose role grants INVOICES_EDIT', async () => {
		const { notifier, repository } = setup(estimate(), []);

		await notifier.notify(accepted);

		expect(repository.manager.find).toHaveBeenCalledWith(Employee, {
			where: {
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				isActive: true,
				isArchived: false,
				user: {
					isActive: true,
					role: { rolePermissions: { permission: PermissionsEnum.INVOICES_EDIT, enabled: true } }
				}
			},
			select: { id: true, userId: true }
		});
	});

	it('reads the answered document in the tenant of the answer, whatever it has become since', async () => {
		const { notifier, repository } = setup(estimate(), []);

		await notifier.notify(accepted);

		expect(repository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'estimate-1', tenantId: TENANT } })
		);
	});

	it('emails the creator the answer in their language, with the amount written that way', async () => {
		const { notifier, emailService } = setup(estimate(), [{ id: 'employee-1', userId: 'user-creator' }]);

		await notifier.notify(accepted);

		expect(emailService.sendEstimateAnswered).toHaveBeenCalledWith({
			languageCode: LanguagesEnum.BULGARIAN,
			email: 'creator@org.test',
			user: expect.objectContaining({ id: 'user-creator' }),
			organization: { id: ORGANIZATION, name: 'Ever Org', tenantId: TENANT },
			invoiceId: 'estimate-1',
			invoiceNumber: 12,
			isAccepted: true,
			isConverted: false,
			contactName: 'Acme Corp',
			contactEmail: 'billing@acme.test',
			// Bulgarian writes a decimal comma, and groups digits from the fifth one on
			amount: '1250,00',
			currency: 'EUR'
		});
	});

	it('reads the draft invoice an acceptance turned the estimate into, and tells it as one', async () => {
		const converted = { ...accepted, isConverted: true };
		const { notifier, repository, eventBus, emailService } = setup(estimate({ isEstimate: false }), [
			{ id: 'employee-1', userId: 'user-accountant' }
		]);

		await notifier.notify(converted);

		expect(repository.findOne).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'estimate-1', tenantId: TENANT } })
		);
		expect(published(eventBus)).toEqual([
			expect.objectContaining({
				title: 'Acme Corp accepted estimate #12',
				message:
					'Total: 1,250.00 EUR. Answered from billing@acme.test. It is now a draft invoice, ready for you to review and send.',
				entity: BaseEntityEnum.Invoice,
				entityId: 'estimate-1'
			})
		]);
		expect(emailService.sendEstimateAnswered).toHaveBeenCalledWith(
			expect.objectContaining({ isAccepted: true, isConverted: true })
		);
	});

	it('still tells a decline when another answer converted the estimate before it was read', async () => {
		const { notifier, eventBus, emailService } = setup(estimate({ isEstimate: false }), [
			{ id: 'employee-1', userId: 'user-accountant' }
		]);

		await notifier.notify({ ...accepted, isAccepted: false });

		expect(published(eventBus)).toEqual([
			expect.objectContaining({
				title: 'Acme Corp declined estimate #12',
				message:
					'Total: 1,250.00 EUR. Answered from billing@acme.test. You can follow up with the client or send a revised estimate.'
			})
		]);
		expect(emailService.sendEstimateAnswered).toHaveBeenCalledWith(
			expect.objectContaining({ isAccepted: false, isConverted: false })
		);
	});

	it('emails a declined estimate in English to a creator who chose no language', async () => {
		const creator = { id: 'user-creator', email: 'creator@org.test', isActive: true };
		const { notifier, emailService } = setup(estimate({ createdByUser: creator as never }), []);

		await notifier.notify({ ...accepted, isAccepted: false, answeredFrom: null });

		expect(emailService.sendEstimateAnswered).toHaveBeenCalledWith(
			expect.objectContaining({
				languageCode: LanguagesEnum.ENGLISH,
				isAccepted: false,
				contactEmail: null,
				amount: '1,250.00'
			})
		);
	});

	it('leaves the creator to the Inbox where it emails the notification they get', async () => {
		process.env.GAUZY_INBOX_ENABLED = 'true';
		process.env.GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED = 'true';
		const { notifier, emailService, eventBus } = setup(estimate(), [{ id: 'employee-1', userId: 'user-creator' }]);

		await notifier.notify(accepted);

		expect(eventBus.publish).toHaveBeenCalledTimes(1);
		expect(emailService.sendEstimateAnswered).not.toHaveBeenCalled();
	});

	it('still emails a creator the Inbox does not notify, an admin with no employee profile', async () => {
		process.env.GAUZY_INBOX_ENABLED = 'true';
		process.env.GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED = 'true';
		const { notifier, emailService } = setup(estimate(), [{ id: 'employee-2', userId: 'user-accountant' }]);

		await notifier.notify(accepted);

		expect(emailService.sendEstimateAnswered).toHaveBeenCalledTimes(1);
	});

	it('notifies in-app only when the estimate has no known creator', async () => {
		const { notifier, emailService, eventBus } = setup(estimate({ createdByUser: null }), [
			{ id: 'employee-1', userId: 'user-1' }
		]);

		await notifier.notify(accepted);

		expect(eventBus.publish).toHaveBeenCalledTimes(1);
		expect(emailService.sendEstimateAnswered).not.toHaveBeenCalled();
	});

	it('tells nobody of an estimate it cannot find in the tenant', async () => {
		const { notifier, emailService, eventBus, repository } = setup(null, [{ id: 'employee-1', userId: 'user-1' }]);

		await notifier.notify(accepted);

		expect(repository.manager.find).not.toHaveBeenCalled();
		expect(eventBus.publish).not.toHaveBeenCalled();
		expect(emailService.sendEstimateAnswered).not.toHaveBeenCalled();
	});
});
