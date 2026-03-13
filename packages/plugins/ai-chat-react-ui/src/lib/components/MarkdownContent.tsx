import { type CSSProperties } from 'react';
import { chatTheme } from '../chat-theme';

export interface MarkdownContentProps {
	content: string;
}

/**
 * MarkdownContent
 *
 * Lightweight markdown renderer for assistant messages.
 * Supports basic formatting: bold, italic, inline code,
 * code blocks, lists, and line breaks.
 *
 * Uses `dangerouslySetInnerHTML` with a simple parser —
 * no external markdown library required. For production,
 * consider swapping to `react-markdown` or similar.
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
	const html = parseMarkdown(content);

	const style: CSSProperties = {
		fontSize: chatTheme.fontSizeBase,
		lineHeight: 1.6,
		color: 'inherit',
		wordBreak: 'break-word'
	};

	return (
		<div
			style={style}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

// ── Lightweight markdown parser ──────────────────────────────────────────────

function parseMarkdown(text: string): string {
	let html = escapeHtml(text);

	// Code blocks: ```lang\ncode\n```
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
		return `<pre style="background:#1e1e2e;color:#cdd6f4;padding:12px;border-radius:8px;overflow-x:auto;font-size:0.8rem;margin:8px 0;"><code>${code.trim()}</code></pre>`;
	});

	// Inline code: `code`
	html = html.replace(/`([^`]+)`/g, (_match, code) => {
		return `<code style="background:#f0f0f4;padding:2px 6px;border-radius:4px;font-size:0.82em;color:#d63384;">${code}</code>`;
	});

	// Bold: **text**
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

	// Italic: *text*
	html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

	// Unordered list items: - item
	html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>');

	// Ordered list items: 1. item
	html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>');

	// Headers: ### heading
	html = html.replace(/^### (.+)$/gm, '<h4 style="margin:8px 0 4px;font-size:0.9rem;">$1</h4>');
	html = html.replace(/^## (.+)$/gm, '<h3 style="margin:8px 0 4px;font-size:0.95rem;">$1</h3>');
	html = html.replace(/^# (.+)$/gm, '<h2 style="margin:8px 0 4px;font-size:1rem;">$1</h2>');

	// Line breaks
	html = html.replace(/\n/g, '<br/>');

	return html;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
