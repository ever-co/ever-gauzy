import { CreateChatTables1791000006100 } from './migrations/1791000006100-CreateChatTables';
import { SeedChatRolePermissions1791000006200 } from './migrations/1791000006200-SeedChatRolePermissions';
import { SeedChatFeature1791000006300 } from './migrations/1791000006300-SeedChatFeature';
import { AddChatMessageAssistedBy1791000006400 } from './migrations/1791000006400-AddChatMessageAssistedBy';
import { ScopeChatDirectKeyToOrganization1791000006600 } from './migrations/1791000006600-ScopeChatDirectKeyToOrganization';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const CHAT_MIGRATIONS = [
	CreateChatTables1791000006100,
	SeedChatRolePermissions1791000006200,
	SeedChatFeature1791000006300,
	AddChatMessageAssistedBy1791000006400,
	ScopeChatDirectKeyToOrganization1791000006600
];
