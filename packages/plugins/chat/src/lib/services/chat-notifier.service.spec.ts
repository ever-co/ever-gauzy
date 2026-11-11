/**
 * Reading a conversation marks the caller's notifications about its messages read, and leaves the notifications of
 * replies that live in a thread only to the thread read: opening the conversation must not clear a followed-thread
 * entry the member has not read (spec FR-17).
 *
 * The queries run for real on an in-memory better-sqlite3 store. `@gauzy/core` is doubled at the module boundary (its
 * barrel boots the whole application), as in the other chat specs; the two tables the reads touch are mapped onto the
 * entity classes with schemas of their own, so the entity decorators stay no-ops.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		EmployeeNotification: class EmployeeNotification {},
		RequestContext: { currentUser: () => null }
	};
	return new Proxy(explicit, {
		get: (target, name) => (name in target ? target[name as string] : function Anything() {})
	});
});

import { EventBus } from '@nestjs/cqrs';
import { DataSource, EntitySchema } from 'typeorm';
import { BaseEntityEnum } from '@gauzy/contracts';
import { EmployeeNotification, MentionService } from '@gauzy/core';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatNotifierService } from './chat-notifier.service';

interface IMessageRow {
	id: string;
	tenantId: string;
	conversationId: string;
	threadRootId: string | null;
	alsoInConversation: boolean;
	createdAt: Date;
}

interface INotificationRow {
	id: string;
	tenantId: string;
	receiverEmployeeId: string;
	isRead: boolean;
	readAt: Date | null;
	entity: string;
	entityId: string;
}

const MessageSchema = new EntitySchema<IMessageRow>({
	name: 'ChatMessage',
	target: ChatMessage,
	tableName: 'chat_message',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		conversationId: { type: 'varchar' },
		threadRootId: { type: 'varchar', nullable: true },
		alsoInConversation: { type: 'boolean', default: false },
		createdAt: { type: 'datetime' }
	}
});

const NotificationSchema = new EntitySchema<INotificationRow>({
	name: 'EmployeeNotification',
	target: EmployeeNotification,
	tableName: 'employee_notification',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		receiverEmployeeId: { type: 'varchar' },
		isRead: { type: 'boolean', default: false },
		readAt: { type: 'datetime', nullable: true },
		entity: { type: 'varchar' },
		entityId: { type: 'varchar' }
	}
});

const at = (minute: number) => new Date(Date.UTC(2026, 10, 9, 9, minute, 0));

/** Conversation c1: a message, a reply in its thread only, a reply also sent to the conversation, a later message. */
const MESSAGES: IMessageRow[] = [
	{
		id: 'm1',
		tenantId: 'ten',
		conversationId: 'c1',
		threadRootId: null,
		alsoInConversation: false,
		createdAt: at(1)
	},
	{
		id: 'r1',
		tenantId: 'ten',
		conversationId: 'c1',
		threadRootId: 'm1',
		alsoInConversation: false,
		createdAt: at(2)
	},
	{ id: 'r2', tenantId: 'ten', conversationId: 'c1', threadRootId: 'm1', alsoInConversation: true, createdAt: at(3) },
	{
		id: 'm2',
		tenantId: 'ten',
		conversationId: 'c1',
		threadRootId: null,
		alsoInConversation: false,
		createdAt: at(4)
	},
	{ id: 'm9', tenantId: 'ten', conversationId: 'c2', threadRootId: null, alsoInConversation: false, createdAt: at(1) }
];

const notification = (
	id: string,
	entityId: string,
	entity = BaseEntityEnum.ChatMessage,
	receiverEmployeeId = 'e1'
): INotificationRow => ({
	id,
	tenantId: 'ten',
	receiverEmployeeId,
	isRead: false,
	readAt: null,
	entity,
	entityId
});

const NOTIFICATIONS: INotificationRow[] = [
	notification('n-m1', 'm1'),
	notification('n-r1', 'r1'),
	notification('n-r2', 'r2'),
	notification('n-m2', 'm2'),
	notification('n-mention', 'c1', BaseEntityEnum.ChatConversation),
	notification('n-m9', 'm9'),
	notification('n-e2', 'm1', BaseEntityEnum.ChatMessage, 'e2')
];

const caller = { tenantId: 'ten', employeeId: 'e1' };

describe('ChatNotifierService read marks', () => {
	let dataSource: DataSource;
	let notifier: ChatNotifierService;

	const unread = async (): Promise<string[]> =>
		(await dataSource.getRepository(NotificationSchema).find({ where: { isRead: false } }))
			.map((row) => row.id)
			.sort();

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [MessageSchema, NotificationSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		notifier = new ChatNotifierService(dataSource, {} as EventBus, {} as MentionService);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await dataSource.getRepository(MessageSchema).clear();
		await dataSource.getRepository(NotificationSchema).clear();
		// Copies: an insert writes the values it read back into the objects it was handed.
		await dataSource.getRepository(MessageSchema).insert(MESSAGES.map((row) => ({ ...row })));
		await dataSource.getRepository(NotificationSchema).insert(NOTIFICATIONS.map((row) => ({ ...row })));
	});

	it('reading the conversation clears its messages, a reply also sent to it and its mentions — not a thread-only reply', async () => {
		await expect(notifier.markConversationRead('c1', caller)).resolves.toBe(4);
		expect(await unread()).toEqual(['n-e2', 'n-m9', 'n-r1']);
	});

	it('the thread read then clears the thread-only reply', async () => {
		await expect(notifier.markConversationRead('c1', caller)).resolves.toBe(4);
		expect(await unread()).toEqual(['n-e2', 'n-m9', 'n-r1']);
		await expect(notifier.markThreadRead('m1', caller)).resolves.toBe(1);
		expect(await unread()).toEqual(['n-e2', 'n-m9']);
	});

	it('a partial read clears the messages up to its anchor, and still no thread-only reply', async () => {
		await expect(notifier.markConversationRead('c1', caller, { createdAt: at(3) })).resolves.toBe(2);
		expect(await unread()).toEqual(['n-e2', 'n-m2', 'n-m9', 'n-mention', 'n-r1']);
	});
});
