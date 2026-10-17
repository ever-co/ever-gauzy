import { CreateInboxProviderAccountTable1791000002400 } from './migrations/1791000002400-CreateInboxProviderAccountTable';
import { CreateInboxMailboxTable1791000002500 } from './migrations/1791000002500-CreateInboxMailboxTable';
import { CreateInboxMailboxMemberTable1791000002600 } from './migrations/1791000002600-CreateInboxMailboxMemberTable';
import { CreateInboxEmailThreadTable1791000002700 } from './migrations/1791000002700-CreateInboxEmailThreadTable';
import { CreateInboxEmailTable1791000002800 } from './migrations/1791000002800-CreateInboxEmailTable';
import { CreateInboxEmailAttachmentTable1791000002900 } from './migrations/1791000002900-CreateInboxEmailAttachmentTable';

/** The Inbox email features' migrations, oldest first (ordered with the platform's by their timestamps). */
export const INBOX_EMAIL_MIGRATIONS = [
	CreateInboxProviderAccountTable1791000002400,
	CreateInboxMailboxTable1791000002500,
	CreateInboxMailboxMemberTable1791000002600,
	CreateInboxEmailThreadTable1791000002700,
	CreateInboxEmailTable1791000002800,
	CreateInboxEmailAttachmentTable1791000002900
];
