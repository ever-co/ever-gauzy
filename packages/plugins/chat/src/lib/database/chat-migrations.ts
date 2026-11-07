import { CreateChatTables1791000006100 } from './migrations/1791000006100-CreateChatTables';
import { SeedChatRolePermissions1791000006200 } from './migrations/1791000006200-SeedChatRolePermissions';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const CHAT_MIGRATIONS = [CreateChatTables1791000006100, SeedChatRolePermissions1791000006200];
