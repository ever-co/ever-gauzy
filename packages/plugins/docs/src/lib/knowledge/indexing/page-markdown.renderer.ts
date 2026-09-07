import { DocumentKindEnum } from '@gauzy/contracts';
import { Document } from '../../entities/document.entity';
import { createTurndown } from '../extraction/html.extractor';
import { normalizeMarkdown } from '../extraction/extractor.interface';

/**
 * Server-side markdown rendering of a document's knowledge content.
 *
 * - FILE → the stored `extractedText` (already normalized markdown).
 * - PAGE → the sanitized `contentHtml` render cache converted through the shared
 *   GFM Turndown converter; a `contentJson`-only page falls back to a deterministic
 *   plain-text walk of the TipTap JSON tree.
 * - FOLDER → `null` (never indexable).
 */
export function renderKnowledgeMarkdown(document: Document): string | null {
	if (document.kind === DocumentKindEnum.FILE) {
		return document.extractedText?.trim() ? document.extractedText : null;
	}
	if (document.kind !== DocumentKindEnum.PAGE) {
		return null;
	}

	if (document.contentHtml?.trim()) {
		try {
			const markdown = normalizeMarkdown(createTurndown().turndown(document.contentHtml));
			if (markdown) {
				return markdown;
			}
		} catch {
			// fall through to the JSON walk
		}
	}

	const contentJson = parseContentJson(document.contentJson);
	if (!contentJson) {
		return null;
	}
	const markdown = normalizeMarkdown(walkTipTapNode(contentJson).join('\n\n'));
	return markdown || null;
}

/** Tolerates the sqlite text-serialized column shape. */
function parseContentJson(value: unknown): any {
	if (!value) {
		return null;
	}
	if (typeof value === 'string') {
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}
	return value;
}

/**
 * Deterministic plain-markdown walk of a TipTap JSON node tree (fallback path only —
 * `contentHtml` is the canonical render cache).
 */
function walkTipTapNode(node: any): string[] {
	if (!node || typeof node !== 'object') {
		return [];
	}
	if (node.type === 'text') {
		return typeof node.text === 'string' ? [node.text] : [];
	}

	const children: any[] = Array.isArray(node.content) ? node.content : [];

	switch (node.type) {
		case 'heading':
			return renderHeading(node, children);
		case 'paragraph':
			return asBlock(joinInline(children));
		case 'bulletList':
		case 'orderedList':
			return renderList(node.type, children);
		case 'codeBlock':
			return renderCodeBlock(children);
		case 'blockquote':
			return renderBlockquote(children);
		default:
			return children.flatMap(walkTipTapNode);
	}
}

/** Renders the inline content of a block node as one string. */
function joinInline(children: any[]): string {
	return children.flatMap(walkTipTapNode).join('');
}

/** Wraps a rendered block in the single-element array the walk returns; empty text yields none. */
function asBlock(text: string): string[] {
	return text ? [text] : [];
}

/** `# … ######` — the level is clamped into the 1–6 markdown range. */
function renderHeading(node: any, children: any[]): string[] {
	const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
	return asBlock(joinInline(children)).map((text) => `${'#'.repeat(level)} ${text}`);
}

/** A bullet (`-`) or ordered (`1.`) list; empty items are dropped. */
function renderList(type: 'bulletList' | 'orderedList', children: any[]): string[] {
	const items = children
		.map((item: any, index: number) => {
			const text = (Array.isArray(item?.content) ? item.content : []).flatMap(walkTipTapNode).join(' ');
			const marker = type === 'orderedList' ? `${index + 1}.` : '-';
			return text ? `${marker} ${text}` : '';
		})
		.filter(Boolean);
	return items.length ? [items.join('\n')] : [];
}

/** A fenced code block (no language hint — the TipTap attrs are not carried into the index). */
function renderCodeBlock(children: any[]): string[] {
	return asBlock(joinInline(children)).map((text) => '```\n' + text + '\n```');
}

/** A block quote — every rendered inner line gets the `> ` prefix. */
function renderBlockquote(children: any[]): string[] {
	const inner = children.flatMap(walkTipTapNode);
	return inner.length ? [inner.map((line) => `> ${line}`).join('\n')] : [];
}
