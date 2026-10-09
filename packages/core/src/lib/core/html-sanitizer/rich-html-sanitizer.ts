import * as sanitizeHtml from 'sanitize-html';

/**
 * Shared server-side sanitization policy for the legacy rich-text HTML fields
 * (`Task.description`, `OrganizationProject.description`, `OrganizationProjectModule.description`,
 * `Employee.description`, `Organization.overview`, `HelpCenterArticle.data`,
 * `Proposal.jobPostContent` / `Proposal.proposalContent`, `EmployeeProposalTemplate.content`).
 *
 * These fields accept editor-produced HTML strings from the client and are re-rendered with
 * `[innerHTML]` — including on public, unauthenticated pages — so every write path MUST pass
 * through this allowlist before persisting.
 *
 * The allowlist mirrors 1:1 what the shared `ga-rich-text-editor` (TipTap v3 `standard` preset)
 * can produce — structural blocks, formatting marks, lists, links, images, and tables — so
 * legitimate editor output round-trips unchanged while `script`/`style` elements, `iframe`,
 * `object`/`embed`, form widgets, event-handler attributes (`on*`), `javascript:`/`data:` URLs,
 * and `svg`/`math` are all stripped.
 *
 * Exported as a standalone config object so core entities and plugins (job-proposal,
 * knowledge-base, docs) share one policy.
 */
export const RICH_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		// Structural
		'p',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'br',
		'hr',
		// Formatting marks
		'strong',
		'b',
		'em',
		'i',
		'u',
		's',
		'sub',
		'sup',
		'code',
		'pre',
		'mark',
		'span',
		// Lists / quotes / links / images
		'ul',
		'ol',
		'li',
		'blockquote',
		'a',
		'img',
		// Tables
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'colgroup',
		'col'
	],
	allowedAttributes: {
		a: ['href', 'target', 'rel'],
		img: ['src', 'alt', 'width', 'height'],
		ol: ['start'],
		th: ['colspan', 'rowspan'],
		td: ['colspan', 'rowspan'],
		col: ['span'],
		'*': ['style']
	},
	// `style` is allowed as an attribute but restricted to this safe subset of properties.
	allowedStyles: {
		'*': {
			'text-align': [/^(left|right|center|justify)$/],
			color: [/^#[0-9a-f]{3,8}$/i],
			'background-color': [/^#[0-9a-f]{3,8}$/i],
			'font-family': [/^[\w\s,'"-]+$/]
		}
	},
	// Link schemes: http/https/mailto/tel only (no javascript:, no data:).
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	// Image sources: http/https only — no data:, no blob:.
	allowedSchemesByTag: { img: ['https', 'http'] },
	disallowedTagsMode: 'discard',
	// Force rel="noopener noreferrer" on every link (tab-nabbing hardening).
	transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) }
};

/**
 * Sanitizes a legacy rich-text HTML string against the shared allowlist policy.
 *
 * Idempotent (`sanitizeRichHtml(sanitizeRichHtml(x)) === sanitizeRichHtml(x)`) and safe on
 * empty input: `null`/`undefined`/`''` are returned unchanged so partial-update payloads that
 * omit (or explicitly clear) a field keep their exact semantics.
 *
 * @param html The raw HTML string received from the client (or stored pre-sanitization).
 * @returns The sanitized HTML string.
 */
export function sanitizeRichHtml(html: string): string {
	if (!html) {
		return html;
	}
	return sanitizeHtml(html, RICH_HTML_SANITIZE_OPTIONS);
}
