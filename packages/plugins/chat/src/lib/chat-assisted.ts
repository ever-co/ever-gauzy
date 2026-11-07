/** The most characters of an assistant's name a message keeps (`chat_message.assistedBy`). */
export const CHAT_ASSISTED_BY_MAX_LENGTH = 120;

/**
 * The assistant a sent message is marked with: the name the client stated, trimmed and cut to the column's length;
 * nothing for an omitted or blank one. Only a send sets it — an edit never changes it, and a retry with the same
 * nonce answers the stored message as it is.
 */
export function assistedByOf(value: string | null | undefined): string | null {
	const name = typeof value === 'string' ? value.trim() : '';
	// Cut by code point, as the DTO counts: an emoji at the limit is kept whole, never split into a lone surrogate.
	return name ? Array.from(name).slice(0, CHAT_ASSISTED_BY_MAX_LENGTH).join('') : null;
}
