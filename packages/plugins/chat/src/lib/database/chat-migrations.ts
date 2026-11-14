import { CreateChatTables1791000006100 } from './migrations/1791000006100-CreateChatTables';
import { SeedChatRolePermissions1791000006200 } from './migrations/1791000006200-SeedChatRolePermissions';
import { SeedChatFeature1791000006300 } from './migrations/1791000006300-SeedChatFeature';
import { AddChatMessageAssistedBy1791000006400 } from './migrations/1791000006400-AddChatMessageAssistedBy';
import { ScopeChatDirectKeyToOrganization1791000006600 } from './migrations/1791000006600-ScopeChatDirectKeyToOrganization';
import { CreateChatLinkPreviewTable1791000006710 } from './migrations/1791000006710-CreateChatLinkPreviewTable';
import { CreateChatWebhooks1791000006730 } from './migrations/1791000006730-CreateChatWebhooks';
import { CreateChatAttachmentDraftTable1791000007310 } from './migrations/1791000007310-CreateChatAttachmentDraftTable';
import { AddChatMessageAttachmentNames1791000007320 } from './migrations/1791000007320-AddChatMessageAttachmentNames';
import { AddChatWebhookInteractionIdempotencyKey1791000008300 } from './migrations/1791000008300-AddChatWebhookInteractionIdempotencyKey';
import { ChatMessageNonceBinaryCollation1791000008700 } from './migrations/1791000008700-ChatMessageNonceBinaryCollation';

/** The plugin's migrations, oldest first (ordered with the platform's by their timestamps). */
export const CHAT_MIGRATIONS = [
	CreateChatTables1791000006100,
	SeedChatRolePermissions1791000006200,
	SeedChatFeature1791000006300,
	AddChatMessageAssistedBy1791000006400,
	ScopeChatDirectKeyToOrganization1791000006600,
	CreateChatLinkPreviewTable1791000006710,
	CreateChatWebhooks1791000006730,
	CreateChatAttachmentDraftTable1791000007310,
	AddChatMessageAttachmentNames1791000007320,
	AddChatWebhookInteractionIdempotencyKey1791000008300,
	ChatMessageNonceBinaryCollation1791000008700
];
