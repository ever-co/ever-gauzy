import { MigrationInterface, QueryRunner } from 'typeorm';
import { ChatDialect, columnTypes, createTableIfMissing, dropTableIfExists, lockMigrations, TableSpec } from '../migration-helpers';

/** The chat tables, in dependency order (a conversation before its members and messages). */
export const CHAT_TABLES: TableSpec[] = [
	{
		table: 'chat_category',
		prefix: 'chat_category',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [t.varchar('name', 120, true), t.int('position')].join(', ');
		},
		indexes: [],
		foreignKeys: []
	},
	{
		table: 'chat_conversation',
		prefix: 'chat_conversation',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [
				t.varchar('kind', 16, true),
				t.varchar('name', 120),
				t.varchar('topic', 500),
				t.varchar('visibility', 16, true, 'public'),
				t.uuid('categoryId', false),
				t.int('position'),
				t.bool('isDefault'),
				t.uuid('createdByEmployeeId', false),
				t.int('messageCount'),
				t.ts('lastMessageAt'),
				t.varchar('directKey', 64)
			].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_conversation_kind', columns: ['kind'] },
			{ name: 'IDX_chat_conversation_category', columns: ['categoryId'] },
			{
				name: 'UQ_chat_conversation_direct_key',
				columns: ['tenantId', 'directKey'],
				unique: true,
				where: { postgres: '"directKey" IS NOT NULL', sqlite: '"directKey" IS NOT NULL' }
			}
		],
		foreignKeys: [{ name: 'FK_chat_conversation_category', column: 'categoryId', references: 'chat_category', onDelete: 'SET NULL' }]
	},
	{
		table: 'chat_member',
		prefix: 'chat_member',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [
				t.uuid('conversationId'),
				t.uuid('employeeId'),
				t.uuid('userId'),
				t.varchar('role', 16, true, 'member'),
				t.varchar('notifyLevel', 16, true, 'all'),
				t.bool('isFavorite'),
				t.int('readCount'),
				t.int('mentionCount'),
				t.uuid('lastReadMessageId', false),
				t.ts('lastReadAt'),
				t.ts('joinedAt'),
				t.ts('leftAt')
			].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_member_conversation', columns: ['conversationId'] },
			{ name: 'IDX_chat_member_user', columns: ['userId'] },
			{ name: 'IDX_chat_member_employee', columns: ['employeeId'] },
			{ name: 'UQ_chat_member_conversation_employee', columns: ['conversationId', 'employeeId'], unique: true }
		],
		foreignKeys: [
			{ name: 'FK_chat_member_conversation', column: 'conversationId', references: 'chat_conversation', onDelete: 'CASCADE' },
			{ name: 'FK_chat_member_employee', column: 'employeeId', references: 'employee', onDelete: 'CASCADE' },
			{ name: 'FK_chat_member_user', column: 'userId', references: 'user', onDelete: 'CASCADE' }
		]
	},
	{
		table: 'chat_message',
		prefix: 'chat_message',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [
				t.uuid('conversationId'),
				t.uuid('authorEmployeeId', false),
				t.uuid('authorUserId', false),
				t.varchar('kind', 16, true, 'message'),
				t.requiredText('body'),
				t.text('mentionEmployeeIds'),
				t.bool('mentionsChannel'),
				t.bool('mentionsHere'),
				t.uuid('replyToId', false),
				t.uuid('threadRootId', false),
				t.bool('alsoInConversation'),
				t.int('replyCount'),
				t.ts('lastReplyAt'),
				t.ts('pinnedAt'),
				t.uuid('pinnedByEmployeeId', false),
				t.ts('editedAt'),
				t.text('attachmentIds'),
				t.varchar('nonce', 64),
				t.varchar('appName', 120)
			].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_message_conversation_created', columns: ['conversationId', 'createdAt'] },
			{ name: 'IDX_chat_message_thread_root', columns: ['threadRootId'] },
			{ name: 'IDX_chat_message_author_user', columns: ['authorUserId'] },
			{
				name: 'UQ_chat_message_author_nonce',
				columns: ['authorUserId', 'nonce'],
				unique: true,
				where: { postgres: '"nonce" IS NOT NULL', sqlite: '"nonce" IS NOT NULL' }
			}
		],
		foreignKeys: [{ name: 'FK_chat_message_conversation', column: 'conversationId', references: 'chat_conversation', onDelete: 'CASCADE' }]
	},
	{
		table: 'chat_thread_follow',
		prefix: 'chat_thread_follow',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [t.uuid('rootMessageId'), t.uuid('employeeId'), t.uuid('userId'), t.int('unreadReplies'), t.ts('lastReadReplyAt')].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_thread_follow_user', columns: ['userId'] },
			{ name: 'UQ_chat_thread_follow_root_employee', columns: ['rootMessageId', 'employeeId'], unique: true }
		],
		foreignKeys: [
			{ name: 'FK_chat_thread_follow_root', column: 'rootMessageId', references: 'chat_message', onDelete: 'CASCADE' },
			{ name: 'FK_chat_thread_follow_employee', column: 'employeeId', references: 'employee', onDelete: 'CASCADE' }
		]
	},
	{
		table: 'chat_task_reference',
		prefix: 'chat_task_reference',
		columns: (d: ChatDialect) => {
			const t = columnTypes(d);
			return [t.uuid('messageId'), t.uuid('taskId'), t.varchar('kind', 16, true, 'mention')].join(', ');
		},
		indexes: [
			{ name: 'IDX_chat_task_reference_task', columns: ['taskId'] },
			{ name: 'UQ_chat_task_reference_message_task', columns: ['messageId', 'taskId'], unique: true }
		],
		foreignKeys: [
			{ name: 'FK_chat_task_reference_message', column: 'messageId', references: 'chat_message', onDelete: 'CASCADE' },
			{ name: 'FK_chat_task_reference_task', column: 'taskId', references: 'task', onDelete: 'CASCADE' }
		]
	}
];

/**
 * The chat tables (the Chat spec, plan §3): categories, conversations, members, messages, thread follows and task
 * references. Registered only with the plugin (`GAUZY_CHAT_ENABLED=true`), idempotent, serialised on Postgres,
 * written for PostgreSQL, MySQL and SQLite; reversible (the tables are dropped in reverse order).
 */
export class CreateChatTables1791000006100 implements MigrationInterface {
	name = 'CreateChatTables1791000006100';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		for (const spec of CHAT_TABLES) {
			await createTableIfMissing(queryRunner, spec);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		for (const spec of [...CHAT_TABLES].reverse()) {
			await dropTableIfExists(queryRunner, spec.table);
		}
	}
}
