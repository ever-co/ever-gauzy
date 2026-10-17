import { createHash } from 'node:crypto';

/**
 * A UUID derived from a seed (RFC 4122 layout, version 5 nibble), the same every time: the id a sync
 * gives a Gauzy record it creates for an Ever Works one (`<mapping>:<kind>:<ever works id>`). A retry
 * after a failure half-way (the row written, its relations or link not) finds the row it wrote instead of
 * creating a second one.
 */
export function stableUuid(seed: string): string {
	const hex = createHash('sha256').update(seed).digest('hex');
	const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
