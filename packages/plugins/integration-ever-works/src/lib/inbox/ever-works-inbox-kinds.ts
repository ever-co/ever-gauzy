import { InboxItemKindEnum } from '@gauzy/contracts';

/**
 * The kinds of an Ever Works inbox item made from a Gauzy Inbox item (`POST /inbox/items`, contract `kind`), in the
 * order the person's preference lists them. Each person chooses which of them go to Ever Works; all are on by default.
 */
export const EVER_WORKS_INBOX_KINDS = ['notice', 'question', 'approval', 'mention', 'assignment', 'email', 'other'] as const;

export type EverWorksInboxKind = (typeof EVER_WORKS_INBOX_KINDS)[number];

/** Whether a value is one of {@link EVER_WORKS_INBOX_KINDS}. */
export function isEverWorksInboxKind(value: unknown): value is EverWorksInboxKind {
	return typeof value === 'string' && (EVER_WORKS_INBOX_KINDS as ReadonlyArray<string>).includes(value);
}

/**
 * The platform's own notification types (`EmployeeNotificationTypeEnum`) a Gauzy notice may name in
 * `metadata.notificationType`: a mention and an assignment have kinds of their own in Ever Works.
 */
const NOTICE_KINDS: Readonly<Record<string, EverWorksInboxKind>> = {
	mention: 'mention',
	assignment: 'assignment'
};

/**
 * The Ever Works kind of a Gauzy Inbox item:
 *
 * | Gauzy kind | Ever Works kind |
 * | --- | --- |
 * | `QUESTION` | `question` |
 * | `APPROVAL` | `approval` |
 * | `ESCALATION` | `question` (its options are kept as choices; Ever Works takes no escalation from an integration) |
 * | `NOTICE` | `notice`; `mention` / `assignment` when `metadata.notificationType` says `Mention` / `Assignment` |
 * | `EMAIL` | `email` |
 * | any other | `other` |
 */
export function everWorksKindOf(kind: InboxItemKindEnum | string, metadata?: Record<string, unknown> | null): EverWorksInboxKind {
	switch (kind) {
		case InboxItemKindEnum.QUESTION:
		case InboxItemKindEnum.ESCALATION:
			return 'question';
		case InboxItemKindEnum.APPROVAL:
			return 'approval';
		case InboxItemKindEnum.EMAIL:
			return 'email';
		case InboxItemKindEnum.NOTICE: {
			const type = metadata?.['notificationType'];
			return (typeof type === 'string' && NOTICE_KINDS[type.trim().toLowerCase()]) || 'notice';
		}
		default:
			return 'other';
	}
}

/** Every kind on, the default. */
export function allEverWorksInboxKinds(): Record<EverWorksInboxKind, boolean> {
	return Object.fromEntries(EVER_WORKS_INBOX_KINDS.map((kind) => [kind, true])) as Record<EverWorksInboxKind, boolean>;
}
