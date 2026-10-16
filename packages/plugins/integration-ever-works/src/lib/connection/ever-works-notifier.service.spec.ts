/**
 * The integration's notices (G-P3-5): an Inbox NOTICE (`source = SYSTEM`, one per connection and kind) where
 * the Inbox is loaded, otherwise the employee-notification fallback; a dead letter goes to the Inbox only.
 */
jest.mock('@gauzy/core', () => {
	const entity = (name: string) => ({ [name]: class {} })[name];
	return {
		Employee: entity('Employee'),
		EmployeeNotification: entity('EmployeeNotification')
	};
});

import {
	BaseEntityEnum,
	IInboxItemUpsertInput,
	IInboxItemWriter,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum
} from '@gauzy/contracts';
import { Employee, EmployeeNotification } from '@gauzy/core';
import type { DataSource } from 'typeorm';
import type { EverWorksConnection } from './ever-works-connection.entity';
import { EVER_WORKS_NOTICE_SOURCE, EverWorksNotifier } from './ever-works-notifier.service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE = '44444444-4444-4444-8444-444444444444';

const connection = {
	id: 'conn-1',
	tenantId: TENANT,
	organizationId: ORG,
	connectedByUserId: ADMIN,
	status: 'needs_reauth'
} as unknown as EverWorksConnection;

function fakeDataSource(employee: { id: string } | null = { id: EMPLOYEE }) {
	const saved: unknown[] = [];
	const repositories = new Map<unknown, unknown>([
		[Employee, { findOne: jest.fn(async () => employee) }],
		[
			EmployeeNotification,
			{ create: jest.fn((value) => value), save: jest.fn(async (value) => (saved.push(value), value)) }
		]
	]);
	return {
		dataSource: { getRepository: (target: unknown) => repositories.get(target) } as unknown as DataSource,
		saved
	};
}

function fakeInbox(behaviour: 'delivers' | 'skips' | 'throws' = 'delivers') {
	const calls: IInboxItemUpsertInput[] = [];
	const writer: IInboxItemWriter = {
		create: jest.fn(),
		upsertExternal: jest.fn(async (input: IInboxItemUpsertInput) => {
			calls.push(input);
			if (behaviour === 'throws') throw new Error('database is locked');
			return {
				item: { id: 'item-1' } as never,
				created: true,
				recipientUserIds: behaviour === 'delivers' ? [ADMIN] : [],
				skippedUserIds: behaviour === 'delivers' ? [] : [ADMIN]
			};
		})
	};
	return { writer, calls };
}

describe('EverWorksNotifier', () => {
	it('with the Inbox: one SYSTEM notice per connection and kind, unread again on a repeat, no employee notification', async () => {
		const { dataSource, saved } = fakeDataSource();
		const { writer, calls } = fakeInbox();
		const notifier = new EverWorksNotifier(dataSource, writer);

		await expect(notifier.needsReauth(connection)).resolves.toBe(true);
		await expect(notifier.needsReauth(connection)).resolves.toBe(true);

		expect(calls).toHaveLength(2);
		expect(calls[0]).toMatchObject({
			tenantId: TENANT,
			organizationId: ORG,
			kind: InboxItemKindEnum.NOTICE,
			source: InboxItemSourceEnum.SYSTEM,
			externalSource: EVER_WORKS_NOTICE_SOURCE,
			externalId: 'conn-1:needs_reauth',
			priority: InboxItemPriorityEnum.HIGH,
			entity: BaseEntityEnum.Organization,
			entityId: ORG,
			recipients: [{ userId: ADMIN, isRead: false, isArchived: false }],
			metadata: expect.objectContaining({
				integration: 'ever_works',
				connectionId: 'conn-1',
				notice: 'needs_reauth'
			})
		});
		expect(calls[1].externalId).toBe(calls[0].externalId);
		expect(saved).toHaveLength(0);
	});

	it('falls back to the employee notification when the Inbox refuses or does not deliver', async () => {
		for (const behaviour of ['throws', 'skips'] as const) {
			const { dataSource, saved } = fakeDataSource();
			const { writer } = fakeInbox(behaviour);
			await expect(new EverWorksNotifier(dataSource, writer).needsReauth(connection)).resolves.toBe(true);
			expect(saved).toEqual([
				expect.objectContaining({
					receiverEmployeeId: EMPLOYEE,
					title: 'Ever Works needs a new key',
					entityId: ORG
				})
			]);
		}
	});

	it('without the Inbox (the default): the employee notification, as before', async () => {
		const { dataSource, saved } = fakeDataSource();
		await expect(new EverWorksNotifier(dataSource).needsReauth(connection)).resolves.toBe(true);
		expect(saved).toHaveLength(1);

		// No employee record of the admin there: the log only.
		const without = fakeDataSource(null);
		await expect(new EverWorksNotifier(without.dataSource).needsReauth(connection)).resolves.toBe(false);
		expect(without.saved).toHaveLength(0);
	});

	it('a dead letter goes to the Inbox only: one notice per connection naming the latest record', async () => {
		const { dataSource, saved } = fakeDataSource();
		const { writer, calls } = fakeInbox();
		const notifier = new EverWorksNotifier(dataSource, writer);

		await expect(
			notifier.deadLetter(connection, {
				direction: 'outbound',
				entityType: 'team',
				recordId: 'team-9',
				reason: '422 domain_rule: no'
			})
		).resolves.toBe(true);
		expect(calls[0]).toMatchObject({
			externalId: 'conn-1:dead_letter',
			priority: InboxItemPriorityEnum.NORMAL,
			metadata: expect.objectContaining({ direction: 'outbound', entityType: 'team', recordId: 'team-9' })
		});
		expect(calls[0].body).toContain('to Ever Works: team team-9');

		// The Inbox refuses: no employee notification for a dead letter (it would flood the bell).
		const refusing = fakeInbox('throws');
		await expect(
			new EverWorksNotifier(dataSource, refusing.writer).deadLetter(connection, {
				direction: 'inbound',
				entityType: 'task',
				reason: 'x'
			})
		).resolves.toBe(false);
		// Without the Inbox: nothing.
		await expect(
			new EverWorksNotifier(dataSource).deadLetter(connection, {
				direction: 'inbound',
				entityType: 'task',
				reason: 'x'
			})
		).resolves.toBe(false);
		expect(saved).toHaveLength(0);
	});

	it('a connection without an admin notifies nobody', async () => {
		const { dataSource, saved } = fakeDataSource();
		const { writer, calls } = fakeInbox();
		const orphan = { ...connection, connectedByUserId: null } as unknown as EverWorksConnection;
		await expect(new EverWorksNotifier(dataSource, writer).needsReauth(orphan)).resolves.toBe(false);
		expect(calls).toHaveLength(0);
		expect(saved).toHaveLength(0);
	});
});
