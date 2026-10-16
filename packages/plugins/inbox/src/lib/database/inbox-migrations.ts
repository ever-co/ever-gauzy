import { CreateInboxItemTable1791000002100 } from './migrations/1791000002100-CreateInboxItemTable';
import { CreateInboxItemRecipientTable1791000002200 } from './migrations/1791000002200-CreateInboxItemRecipientTable';
import { SeedInboxRolePermissions1791000002300 } from './migrations/1791000002300-SeedInboxRolePermissions';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const INBOX_MIGRATIONS = [
	CreateInboxItemTable1791000002100,
	CreateInboxItemRecipientTable1791000002200,
	SeedInboxRolePermissions1791000002300
];
