import '../../../core/entities/internal';

import { randomUUID } from 'crypto';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { EmployeeCreateNotificationEventHandler } from './employee-notification.handler';
import { EmployeeNotificationService } from '../../employee-notification.service';
import { EmployeeNotification } from '../../employee-notification.entity';
import { EmployeeCreateNotificationEvent } from '../employee-notification.event';
import { InMemoryTenantRepository } from '../../../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { assertSideEffectFiresExactly } from '../../../core/testing/idempotency/idempotency.assertions';

/**
 * TASK 4 — the counterpart to `token/commands/handlers/token-cleanup.idempotency.spec.ts`'s
 * positive control. This one WAS a found gap (`EmployeeCreateNotificationEventHandler`
 * unconditionally created a new `EmployeeNotification` row every time it handled the event, with
 * no idempotency key and no "already notified for this input" lookup — a redelivered/replayed
 * event, a duplicate `eventBus.publish()`, or a CQRS-level retry would give the receiving employee
 * a duplicate notification) — now fixed in `EmployeeNotificationService.create()`: before creating,
 * it looks up an existing notification for the same `(receiverEmployeeId, entity, entityId, type)`
 * and returns that instead of inserting again. `entity` + `entityId` identify the specific source
 * record (e.g. one comment, one task assignment), so this only dedupes true redeliveries of the
 * same logical event — a later, separate event about a different entity of the same type still
 * creates its own notification. Mirrors the existing-subscription check already used in
 * `ZapierWebhookService.createSubscription`.
 */
describe('EmployeeCreateNotificationEventHandler idempotency', () => {
	it('redelivering the SAME event does not create a duplicate notification row', async () => {
		const tenant = createTenantFixture();
		const repository = new InMemoryTenantRepository<EmployeeNotification>(new Set(['id', 'tenantId']));
		const createSpy = jest.spyOn(repository, 'save');

		const settingService = {
			findOneByWhereOptions: jest.fn().mockResolvedValue({
				payment: true,
				assignment: true,
				comment: true,
				mention: true,
				message: true,
				invitation: true
			})
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const eventBus = { publish: jest.fn() } as any;

		const service = new EmployeeNotificationService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repository as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			settingService,
			eventBus
		);
		const handler = new EmployeeCreateNotificationEventHandler(service);

		const { restore } = asTenantUser(tenant);
		try {
			const input: IEmployeeNotificationCreateInput = {
				receiverEmployeeId: randomUUID(),
				organizationId: tenant.organizationId,
				type: EmployeeNotificationTypeEnum.MENTION,
				entity: BaseEntityEnum.Comment,
				entityId: randomUUID(),
				title: 'You were mentioned'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any;
			const event = new EmployeeCreateNotificationEvent(input);

			await assertSideEffectFiresExactly({
				run: () => handler.handle(event),
				sideEffect: createSpy,
				expectedCalls: 1,
				times: 2
			});

			expect(repository.all()).toHaveLength(1);
		} finally {
			restore();
		}
	});

	it('a later event about a DIFFERENT entity still creates its own notification (not over-deduped)', async () => {
		const tenant = createTenantFixture();
		const repository = new InMemoryTenantRepository<EmployeeNotification>(new Set(['id', 'tenantId']));

		const settingService = {
			findOneByWhereOptions: jest.fn().mockResolvedValue({ mention: true })
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const eventBus = { publish: jest.fn() } as any;
		const service = new EmployeeNotificationService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repository as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			settingService,
			eventBus
		);
		const handler = new EmployeeCreateNotificationEventHandler(service);
		const receiverEmployeeId = randomUUID();

		const { restore } = asTenantUser(tenant);
		try {
			const baseInput = {
				receiverEmployeeId,
				organizationId: tenant.organizationId,
				type: EmployeeNotificationTypeEnum.MENTION,
				entity: BaseEntityEnum.Comment,
				title: 'You were mentioned'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any;

			await handler.handle(new EmployeeCreateNotificationEvent({ ...baseInput, entityId: randomUUID() }));
			await handler.handle(new EmployeeCreateNotificationEvent({ ...baseInput, entityId: randomUUID() }));

			expect(repository.all()).toHaveLength(2);
		} finally {
			restore();
		}
	});
});
