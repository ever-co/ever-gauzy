// Must stay first: the entities barrel resolves the circular entity imports.
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IInvoice } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { InMemoryTenantRepository } from '../../core/testing/tenant-isolation/in-memory-tenant-repository';
import { MultiORMEnum } from '../../core/utils';
import { EmployeeNotificationSettingService } from '../../employee-notification-setting/employee-notification-setting.service';
import { EmployeeNotificationService } from '../../employee-notification/employee-notification.service';
import { EmployeeCreateNotificationEvent } from '../../employee-notification/events/employee-notification.event';
import { EmployeeCreateNotificationEventHandler } from '../../employee-notification/events/handlers/employee-notification.handler';
import { EstimateAnswerNotifier } from './estimate-answer-notifier.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const ESTIMATE = '88888888-8888-4888-8888-888888888881';
const RECEIVERS = ['55555555-5555-4555-8555-555555555551', '55555555-5555-4555-8555-555555555552'];

const estimate = {
	id: ESTIMATE,
	invoiceNumber: 12,
	totalValue: 1250,
	currency: 'EUR',
	isEstimate: true,
	organizationId: ORGANIZATION,
	tenantId: TENANT,
	toContact: { id: 'contact-1', name: 'Acme Corp' },
	organization: { id: ORGANIZATION, name: 'Ever Org' },
	createdByUser: { id: 'user-creator', email: 'creator@org.test', isActive: true }
} as IInvoice;

/**
 * A client answers an estimate on a public route, where nobody is signed in, so the request context holds no tenant.
 * The tenant-aware writes stamp the tenant they file under from that context, over the one the notice carries
 * (`TenantAwareCrudService.create`): the team's notices, and the notification settings a receiver without any gets,
 * were filed with no tenant, where no receiver could read them. This runs the way a notice is filed with the production
 * classes (the notifier, the event handler, the notification service and the settings service, each over an in-memory
 * repository), from a request with no user.
 */
describe('EstimateAnswerNotifier, answering from the public estimate link', () => {
	const originalClsService = RequestContext['clsService'];

	beforeAll(() => RequestContext.setClsService(new ClsService(new AsyncLocalStorage())));
	afterAll(() => RequestContext.setClsService(originalClsService));

	function setup() {
		const notifications = new InMemoryTenantRepository(new Set(['id', 'tenantId', 'organizationId']));
		const settings = new InMemoryTenantRepository(new Set(['id', 'tenantId', 'organizationId', 'employeeId']));

		const settingService = new EmployeeNotificationSettingService(settings as never, {} as never);
		const notificationService = new EmployeeNotificationService(
			notifications as never,
			{} as never,
			settingService,
			{ publish: jest.fn() } as never
		);
		// The ORM switch is resolved from DB_ORM at module load; pin it so the suite ignores the local .env.
		for (const service of [settingService, notificationService]) {
			Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		}
		const handler = new EmployeeCreateNotificationEventHandler(notificationService);

		// Delivers each event to its handler at once, as the in-process event bus does
		const handled: Promise<unknown>[] = [];
		const eventBus = {
			publish: (event: unknown) => {
				if (event instanceof EmployeeCreateNotificationEvent) {
					handled.push(handler.handle(event));
				}
			}
		};
		const invoices = {
			findOne: jest.fn(async () => estimate),
			manager: {
				find: jest.fn(async () => RECEIVERS.map((id, index) => ({ id, userId: `user-${index}` })))
			}
		};
		const emailService = { sendEstimateAnswered: jest.fn(async () => undefined) };
		const notifier = new EstimateAnswerNotifier(invoices as never, emailService as never, eventBus as never);

		return { notifier, handled, notifications, settings, emailService };
	}

	/** Runs `work` the way the answer route runs: inside a request with no user. */
	function fromPublicRequest(work: () => Promise<void>): Promise<void> {
		const request = { headers: {}, query: {}, params: {}, body: {} };
		return RequestContext.runWithRequest(request as never, work);
	}

	it("files every notice in the estimate's tenant and organization", async () => {
		const { notifier, handled, notifications } = setup();

		await fromPublicRequest(async () => {
			expect(RequestContext.currentTenantId()).toBeNull();
			await notifier.notify({ invoiceId: ESTIMATE, tenantId: TENANT, isAccepted: true, answeredFrom: null });
			await Promise.all(handled);
		});

		const filed = notifications.all();
		expect(filed.map((row) => row.receiverEmployeeId).sort()).toEqual(RECEIVERS);
		for (const row of filed) {
			expect(row).toMatchObject({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				type: EmployeeNotificationTypeEnum.INVOICE,
				entity: BaseEntityEnum.Invoice,
				entityId: ESTIMATE
			});
		}
	});

	it('files the notification settings a receiver without any gets in that tenant too', async () => {
		const { notifier, handled, settings } = setup();

		await fromPublicRequest(async () => {
			await notifier.notify({ invoiceId: ESTIMATE, tenantId: TENANT, isAccepted: false, answeredFrom: null });
			await Promise.all(handled);
		});

		const created = settings.all();
		expect(created.map((row) => row.employeeId).sort()).toEqual(RECEIVERS);
		for (const row of created) {
			expect(row).toMatchObject({ tenantId: TENANT, organizationId: ORGANIZATION });
		}
	});

	it('leaves the public request as it found it: nobody signed in', async () => {
		const { notifier, handled } = setup();

		await fromPublicRequest(async () => {
			await notifier.notify({ invoiceId: ESTIMATE, tenantId: TENANT, isAccepted: true, answeredFrom: null });
			await Promise.all(handled);

			expect(RequestContext.currentUser()).toBeFalsy();
			expect(RequestContext.currentTenantId()).toBeNull();
		});
	});
});
