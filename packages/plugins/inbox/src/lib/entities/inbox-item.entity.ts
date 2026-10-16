import {
	ID,
	InboxItemBodyFormatEnum,
	InboxItemKindEnum,
	InboxItemPriorityEnum,
	InboxItemSourceEnum,
	InboxItemStatusEnum
} from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxItemRepository } from './inbox.repositories';

/**
 * `inbox_item` (plan 04 §2): something addressed to one or more users — a question, an approval, an
 * escalation, a notice (and, from P4, an email). The item carries what is asked and its answer; each
 * recipient's read / archive / snooze state is its own `inbox_item_recipient` row.
 *
 * `options`, `response` and `metadata` are JSON documents stored as text (the same on the three databases);
 * `InboxService` parses them. An item a source created carries its identity there (`externalSource` +
 * `externalId`), unique per tenant, so a re-delivered source item updates instead of duplicating.
 *
 * A column without an explicit `type` takes it from the property's design type. This package builds with
 * `strictNullChecks`, where `Date | null` and `ID | null` are emitted as `Object`, which TypeORM refuses
 * ("Data type Object is not supported") and the API would not boot. So those columns are typed `?: Date` /
 * `?: ID` (they are still nullable in the table); only columns with an explicit `type` say `| null`.
 */
@MultiORMEntity('inbox_item', { mikroOrmRepository: () => MikroOrmInboxItemRepository })
export class InboxItem extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind!: InboxItemKindEnum;

	@MultiORMColumn({ type: 'varchar', length: 32 })
	source!: InboxItemSourceEnum | string;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxItemStatusEnum.OPEN })
	status!: InboxItemStatusEnum;

	@MultiORMColumn({ type: 'varchar', length: 300 })
	title!: string;

	@MultiORMColumn({ type: 'text', nullable: true })
	body?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxItemBodyFormatEnum.PLAIN })
	bodyFormat!: InboxItemBodyFormatEnum;

	/** JSON `[{ id, label, description?, recommended? }]`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	options?: string | null;

	@MultiORMColumn({ default: false })
	requireReason!: boolean;

	/** JSON `{ text, optionId, answeredByUserId, answeredAt, routed }`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	response?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: InboxItemPriorityEnum.NORMAL })
	priority!: InboxItemPriorityEnum;

	@MultiORMColumn({ nullable: true })
	dueAt?: Date;

	/** The primary link (`BaseEntityEnum`) and its id. */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	entity?: string | null;

	@MultiORMColumn({ nullable: true })
	entityId?: ID;

	@MultiORMColumn({ nullable: true })
	taskId?: ID;

	@MultiORMColumn({ nullable: true })
	projectId?: ID;

	@MultiORMColumn({ nullable: true })
	agentEmployeeId?: ID;

	/** EMAIL items (P4). */
	@MultiORMColumn({ nullable: true })
	mailboxId?: ID;

	@MultiORMColumn({ nullable: true })
	emailId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	externalSource?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string | null;

	/** JSON object. */
	@MultiORMColumn({ type: 'text', nullable: true })
	metadata?: string | null;
}
