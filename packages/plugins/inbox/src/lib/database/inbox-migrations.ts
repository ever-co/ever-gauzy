import { CreateInboxItemTable1791000002100 } from './migrations/1791000002100-CreateInboxItemTable';
import { CreateInboxItemRecipientTable1791000002200 } from './migrations/1791000002200-CreateInboxItemRecipientTable';
import { SeedInboxRolePermissions1791000002300 } from './migrations/1791000002300-SeedInboxRolePermissions';
import { AddInboxRecipientDoneAt1791000005200 } from './migrations/1791000005200-AddInboxRecipientDoneAt';
import { AddInboxRecipientUserCreatedAtIndex1791000005250 } from './migrations/1791000005250-AddInboxRecipientUserCreatedAtIndex';
import { CreateInboxSweepCheckpointTable1791000006540 } from './migrations/1791000006540-CreateInboxSweepCheckpointTable';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const INBOX_MIGRATIONS = [
	CreateInboxItemTable1791000002100,
	CreateInboxItemRecipientTable1791000002200,
	SeedInboxRolePermissions1791000002300,
	AddInboxRecipientDoneAt1791000005200,
	AddInboxRecipientUserCreatedAtIndex1791000005250,
	CreateInboxSweepCheckpointTable1791000006540
];
