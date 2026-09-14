import '../../../core/entities/internal';

import { randomUUID } from 'crypto';
import { EmployeeNotificationTypeEnum, IEmployeeNotificationCreateInput } from '@gauzy/contracts';
import { EmployeeCreateNotificationEventHandler } from './employee-notification.handler';
import { EmployeeNotificationService } from '../../employee-notification.service';
import { EmployeeNotification } from '../../employee-notification.entity';
import { EmployeeCreateNotificationEvent } from '../employee-notification.event';
import { InMemoryTenantRepository } from '../../../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { assertSideEffectFiresExactly } from '../../../core/testing/idempotency/idempotency.assertions';

/**
 * TASK 4 negative control / documented gap — the counterpart to
 * `token/commands/handlers/token-cleanup.idempotency.spec.ts`'s positive control.
 *
 * `EmployeeCreateNotificationEventHandler` (an in-process `@nestjs/cqrs` `IEventHandler`, so it
 * needs no queue/Redis to test — see `packages/core/src/lib/core/testing/idempotency/README.md`)
 * unconditionally creates a new `EmployeeNotification` row every time it handles the event, with
 * no idempotency key, no "already notified for this input" lookup, and no unique constraint to
 * fall back on. If the event is ever redelivered/replayed for the same logical notification — a
 * duplicate `eventBus.publish()`, a CQRS-level retry, or this handler being moved onto a real
 * retryable queue later — the receiving employee gets a duplicate notification.
 *
 * This spec DOCUMENTS that gap with a passing test (asserting the actual, current behavior), it
 * does not fix it — fixing it (e.g. a dedup key derived from
 * `(receiverEmployeeId, type, sourceId)`, or a unique constraint) is scoped as follow-up work; see
 * this folder's README.
 */
describe('EmployeeCreateNotificationEventHandler idempotency (found gap — not fixed in this PR)', () => {
	it('redelivering the SAME event creates a duplicate notification row', async () => {
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
				title: 'You were mentioned'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any;
			const event = new EmployeeCreateNotificationEvent(input);

			// `expectedCalls: times` (rather than `1`) is the documentation: this asserts the CURRENT,
			// undesired behavior — a real dedup guard would make this `expectedCalls: 1` instead, and
			// this test would then need updating alongside that fix.
			await assertSideEffectFiresExactly({
				run: () => handler.handle(event),
				sideEffect: createSpy,
				expectedCalls: 2,
				times: 2
			});

			expect(repository.all()).toHaveLength(2);
		} finally {
			restore();
		}
	});
});
