import { parseTaskReferences, TASK_REFERENCES_MAX } from '@gauzy/core';

/** A task's id in a link: the task pages of the clients (`/task/<id>`, `/tasks/<id>`, `/tasks/view/<id>`) and a `taskId=` query. */
const TASK_LINK_PATTERN = /(?:\/tasks?\/(?:view\/)?|[?&]taskId=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9a-f-])/gi;

/** A mention token of the chat (`<@employeeId>`, `<#conversationId>`, `<!channel>`, `<!here>`). */
const MENTION_TOKEN_PATTERN = /<[@#!][^>\s]*>/g;

/** What a message says about tasks: the references it types (`KEY-number`, upper-cased, each once) and the tasks it links to (ids, each once). */
export interface IChatTaskMentions {
	typed: string[];
	linked: string[];
}

export function taskMentionsIn(body: string | null | undefined): IChatTaskMentions {
	const source = String(body ?? '');
	const typed = parseTaskReferences(source)
		.map((parts) => `${parts.key}-${parts.number}`)
		.slice(0, TASK_REFERENCES_MAX);
	const linked: string[] = [];
	const seen = new Set<string>();
	const pattern = new RegExp(TASK_LINK_PATTERN.source, 'gi');
	for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
		const id = match[1].toLowerCase();
		if (seen.has(id)) continue;
		seen.add(id);
		linked.push(id);
		if (linked.length >= TASK_REFERENCES_MAX) break;
	}
	return { typed, linked };
}

/** The title a task made from a message takes: the message's first line, its mention tokens dropped, cut to `max`. */
export function taskTitleOf(body: string | null | undefined, max = 255): string {
	const lines = String(body ?? '')
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.replace(MENTION_TOKEN_PATTERN, '').replace(/\s+/g, ' ').trim())
		.filter(Boolean);
	const first = lines[0] ?? '';
	return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

/** The platform keeps a description as HTML: the text's characters that would read as markup, escaped. */
function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The description a task made from a message takes: the message's text as HTML (the platform's task description is
 * HTML, and its cleaner drops what reads as an unknown tag) — the mention tokens dropped, a paragraph per block of
 * lines, a line break between the lines of a block. Empty for a message without text.
 */
export function taskDescriptionOf(body: string | null | undefined): string {
	return String(body ?? '')
		.replace(/\r\n/g, '\n')
		.replace(MENTION_TOKEN_PATTERN, '')
		.split(/\n{2,}/)
		.map((block) =>
			block
				.split('\n')
				.map((line) => line.replace(/\s+/g, ' ').trim())
				.filter(Boolean)
				.map(escapeHtml)
				.join('<br>')
		)
		.filter(Boolean)
		.map((block) => `<p>${block}</p>`)
		.join('');
}
