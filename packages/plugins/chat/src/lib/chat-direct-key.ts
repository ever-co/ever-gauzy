import { createHash } from 'node:crypto';
import { ID } from '@gauzy/contracts';

/**
 * The key a direct or group conversation is unique by, per organization: the sorted, deduplicated user ids, hashed.
 * The same people always land in the same conversation of an organization, whoever starts it; people who share two
 * organizations have one in each (the unique index is `tenantId`, `organizationId`, `directKey`).
 */
export function directKeyOf(userIds: readonly ID[]): string {
	const ids = [...new Set(userIds.map((id) => String(id).toLowerCase()))].sort();
	return createHash('sha256').update(ids.join('|')).digest('hex');
}
