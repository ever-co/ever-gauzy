import { DOCS_CONTENT_SCHEMA_INVALID } from '../docs.constants';
import { generateDocumentHtml } from './tiptap-html.serializer';
import {
	collectDocumentMentionIds,
	stripTransientAttributes,
	validateTiptapDocument
} from './tiptap-schema.validator';

/**
 * `contentJson` used to be persisted verbatim behind a bare `@IsDefined()`, so anything that
 * parsed as JSON became the canonical content of a page — including node types no loader knows and
 * `javascript:` hrefs. `08-permissions-security.md` §6.1 makes the TipTap schema the first line of
 * defense; these tests pin each of its three clauses.
 */
const doc = (...content: any[]) => ({ type: 'doc', content });
const paragraph = (...content: any[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: any[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });

/** Asserts a 400 carrying the plugin's machine code rather than a bare class-validator error. */
const expectSchemaRejection = (value: unknown) => {
	expect.assertions(2);
	try {
		validateTiptapDocument(value);
	} catch (error: any) {
		expect(error.getStatus()).toBe(400);
		expect(error.getResponse().code).toBe(DOCS_CONTENT_SCHEMA_INVALID);
	}
};

describe('validateTiptapDocument — structure', () => {
	it('accepts the smallest valid document', () => {
		expect(() => validateTiptapDocument(doc())).not.toThrow();
	});

	it('accepts the full first-party node set', () => {
		expect(() =>
			validateTiptapDocument(
				doc(
					{ type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [text('Title')] },
					paragraph(text('hello', [{ type: 'bold' }, { type: 'italic' }])),
					{ type: 'callout', attrs: { type: 'warning' }, content: [paragraph(text('careful'))] },
					{ type: 'codeBlock', attrs: { language: 'typescript' }, content: [text('const a = 1;')] },
					{ type: 'fileAttachment', attrs: { documentId: 'doc-9', name: 'a.pdf', size: 1, mimeType: 'application/pdf' } },
					{ type: 'embedCard', attrs: { url: 'https://ever.co' } },
					{ type: 'documentMention', attrs: { id: 'doc-2', label: 'Handbook' } },
					{ type: 'inlineMath', attrs: { latex: 'x^2' } }
				)
			)
		).not.toThrow();
	});

	it('rejects a root that is not a `doc` node', () => {
		expectSchemaRejection({ type: 'paragraph', content: [] });
	});

	it('rejects an unknown node type instead of silently stripping it', () => {
		expectSchemaRejection(doc({ type: 'iframe', attrs: { src: 'https://evil.example' } }));
	});

	it('rejects an unknown mark type', () => {
		expectSchemaRejection(doc(paragraph(text('x', [{ type: 'onclick' }]))));
	});

	it('rejects an attribute key outside the schema', () => {
		expectSchemaRejection(doc({ type: 'paragraph', attrs: { onmouseover: 'alert(1)' }, content: [] }));
	});

	it('rejects a text node with no string `text`', () => {
		expectSchemaRejection(doc(paragraph({ type: 'text' })));
	});

	it('rejects a malformed block id', () => {
		expectSchemaRejection(doc({ type: 'paragraph', attrs: { blockId: 'not-a-uuid' }, content: [] }));
	});

	it('accepts a UniqueID block id on any node', () => {
		expect(() =>
			validateTiptapDocument(
				doc({ type: 'paragraph', attrs: { blockId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }, content: [] })
			)
		).not.toThrow();
	});
});

describe('validateTiptapDocument — attribute values (§6.1 step 3)', () => {
	it.each(['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'vbscript:msgbox'])(
		'rejects the link scheme %s',
		(href: string) => {
			expectSchemaRejection(doc(paragraph(text('x', [{ type: 'link', attrs: { href } }]))));
		}
	);

	it.each(['https://ever.co', 'http://ever.co', 'mailto:ever@ever.co', 'tel:+1234', '/pages/documents?id=1'])(
		'accepts the link href %s',
		(href: string) => {
			expect(() =>
				validateTiptapDocument(doc(paragraph(text('x', [{ type: 'link', attrs: { href } }]))))
			).not.toThrow();
		}
	);

	it('rejects an inline `data:` image payload in the canonical JSON', () => {
		expectSchemaRejection(doc({ type: 'image', attrs: { src: 'data:image/png;base64,iVBORw0KGgo=' } }));
	});

	it('accepts the app-relative raw URL the upload flow persists', () => {
		expect(() =>
			validateTiptapDocument(
				doc({ type: 'image', attrs: { src: '/api/plugins/docs/documents/doc-1/raw', documentId: 'doc-1' } })
			)
		).not.toThrow();
	});
});

describe('validateTiptapDocument — denial-of-service ceilings', () => {
	it('rejects pathological nesting', () => {
		let node: any = paragraph(text('deep'));
		for (let index = 0; index < 200; index++) {
			node = { type: 'blockquote', content: [node] };
		}
		expectSchemaRejection(doc(node));
	});
});

describe('stripTransientAttributes', () => {
	it('drops the editor-only `uploadId` from the persisted document', () => {
		const stripped: any = stripTransientAttributes(
			doc({ type: 'image', attrs: { src: '/raw', uploadId: 'pending-1', documentId: 'doc-1' } })
		);

		expect(stripped.content[0].attrs).toEqual({ src: '/raw', documentId: 'doc-1' });
	});

	it('leaves every other attribute untouched', () => {
		const stripped: any = stripTransientAttributes(doc({ type: 'heading', attrs: { level: 3 }, content: [] }));

		expect(stripped.content[0].attrs).toEqual({ level: 3 });
	});
});

describe('collectDocumentMentionIds', () => {
	it('collects nested `documentMention` ids in document order, deduplicated', () => {
		const content = doc(
			paragraph({ type: 'documentMention', attrs: { id: 'doc-a', label: 'A' } }),
			{
				type: 'callout',
				attrs: { type: 'info' },
				content: [
					paragraph(
						{ type: 'documentMention', attrs: { id: 'doc-b', label: 'B' } },
						{ type: 'documentMention', attrs: { id: 'doc-a', label: 'A' } }
					)
				]
			}
		);

		expect(collectDocumentMentionIds(content)).toEqual(['doc-a', 'doc-b']);
	});

	it('ignores employee mentions and id-less nodes', () => {
		const content = doc(
			paragraph(
				{ type: 'employeeMention', attrs: { id: 'employee-1' } },
				{ type: 'documentMention', attrs: { label: 'no id' } }
			)
		);

		expect(collectDocumentMentionIds(content)).toEqual([]);
	});
});

/**
 * The derived render cache. Before this existed, a save that omitted `contentHtml` kept the HTML of
 * the PREVIOUS revision — which is what read-only views render and what `searchIn=content` matches.
 */
describe('generateDocumentHtml', () => {
	it('renders headings, paragraphs and marks', () => {
		const html = generateDocumentHtml(
			doc({ type: 'heading', attrs: { level: 2 }, content: [text('Title')] }, paragraph(text('bold', [{ type: 'bold' }])))
		);

		expect(html).toBe('<h2>Title</h2><p><strong>bold</strong></p>');
	});

	it('escapes text so a derived cache can never carry markup', () => {
		const html = generateDocumentHtml(doc(paragraph(text('<script>alert(1)</script>'))));

		expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
	});

	it('keeps link attributes and forces the safe rel', () => {
		const html = generateDocumentHtml(
			doc(paragraph(text('Ever', [{ type: 'link', attrs: { href: 'https://ever.co' } }])))
		);

		expect(html).toContain('href="https://ever.co"');
		expect(html).toContain('rel="noopener noreferrer nofollow"');
	});

	it('degrades nodes with no sanitizer-allowlisted tag while preserving their text', () => {
		const html = generateDocumentHtml(
			doc({ type: 'callout', attrs: { type: 'warning' }, content: [paragraph(text('careful'))] })
		);

		expect(html).toBe('<blockquote><p>careful</p></blockquote>');
	});

	it('links a file attachment to its authenticated raw route', () => {
		const html = generateDocumentHtml(
			doc({ type: 'fileAttachment', attrs: { documentId: 'doc-9', name: 'report.pdf', size: 10, mimeType: 'application/pdf' } })
		);

		expect(html).toBe('<p><a href="/api/plugins/docs/documents/doc-9/raw">report.pdf</a></p>');
	});
});
