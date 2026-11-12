import { CHAT_MENTION_TOKEN_PATTERN, ID } from '@gauzy/contracts';

/** What a message body mentions, read from its tokens. */
export interface IChatMentions {
	employeeIds: ID[];
	conversationIds: ID[];
	channel: boolean;
	here: boolean;
}

/**
 * Reads the mention tokens of a body: `<@employeeId>`, `<#conversationId>`, `<!channel>`, `<!here>`.
 * Tokens inside fenced or inline code are ignored, as a reader would expect.
 */
export function parseMentions(body: string | null | undefined): IChatMentions {
	const result: IChatMentions = { employeeIds: [], conversationIds: [], channel: false, here: false };
	if (!body) return result;
	const withoutCode = body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
	const pattern = new RegExp(CHAT_MENTION_TOKEN_PATTERN.source, 'g');
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(withoutCode))) {
		const [, kind, id, broadcast] = match;
		if (kind === '@' && id) {
			if (!result.employeeIds.includes(id.toLowerCase())) result.employeeIds.push(id.toLowerCase());
		} else if (kind === '#' && id) {
			if (!result.conversationIds.includes(id.toLowerCase())) result.conversationIds.push(id.toLowerCase());
		} else if (broadcast === 'channel') {
			result.channel = true;
		} else if (broadcast === 'here') {
			result.here = true;
		}
	}
	return result;
}

/**
 * The employees a message mentions: the tokens of the body (the source of truth) merged with the client's hint,
 * restricted to the given members, never the author.
 */
export function mentionedEmployees(
	body: string,
	hint: readonly ID[] | undefined,
	memberEmployeeIds: readonly ID[],
	authorEmployeeId: ID | null | undefined
): ID[] {
	const members = new Set(memberEmployeeIds.map(String));
	const ids = new Set<string>();
	for (const id of [...parseMentions(body).employeeIds, ...(hint ?? []).map(String)]) {
		if (members.has(id) && id !== String(authorEmployeeId ?? '')) ids.add(id);
	}
	return [...ids];
}

/** The body with code and tokens stripped, for a search index or a notification subject (first 140 chars). */
export function plainExcerpt(body: string | null | undefined, max = 140): string {
	if (!body) return '';
	const text = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/<(@|#)[0-9a-fA-F-]{36}>/g, '@…')
		.replace(/<!(channel|here)>/g, '@$1')
		.replace(/[*_~`>#]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * What a message reads as in one line (a notification, an inbox entry): its text, or — for a message of files only —
 * a clip and the files' names (`📎 report.pdf, chart.png`), cut to `max`.
 */
export function messageExcerpt(message: { body?: string | null; attachmentNames?: string | null }, max = 140): string {
	const text = plainExcerpt(message.body, max);
	if (text) return text;
	const names = (message.attachmentNames ?? '')
		.split('\n')
		.map((name) => name.trim())
		.filter(Boolean);
	if (!names.length) return '';
	const line = `📎 ${names.join(', ')}`;
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
