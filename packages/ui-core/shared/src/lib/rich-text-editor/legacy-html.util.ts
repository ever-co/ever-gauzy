/**
 * Pure pre-parse fixups for legacy CKEditor 4 HTML (05-editor-spec.md §3.6).
 *
 * TipTap parses HTML through a strict schema — anything not covered by a registered
 * extension is silently dropped. This function rewrites the handful of legacy
 * constructs CKEditor emitted that the schema cannot parse directly, so the
 * `standard` preset round-trips stored content losslessly:
 *
 * - `<font color face>`            → `<span style="color: …; font-family: …">`
 * - deprecated `align` attribute   → `style="text-align: …"` promotion
 * - `<figure><img><figcaption>`    → image + caption paragraph
 * - `<p>&nbsp;</p>` spacer runs    → empty paragraphs
 * - editor-namespace artifacts     → stripped (`cke_*` classes, `data-cke-*`
 *                                    attributes, HTML comments)
 *
 * Runs client-side only (DOMParser); on the server the input is returned untouched —
 * SSR renders a sanitized `[innerHTML]` preview and never parses into the schema.
 */
export function normalizeLegacyHtml(html: string): string {
	if (!html) {
		return '';
	}
	if (typeof DOMParser === 'undefined') {
		return html;
	}

	const doc = new DOMParser().parseFromString(html, 'text/html');
	const body = doc.body;

	// Strip HTML comments (protected-source markers, conditional comments, …).
	const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
	const comments: Node[] = [];
	while (walker.nextNode()) {
		comments.push(walker.currentNode);
	}
	comments.forEach((comment) => comment.parentNode?.removeChild(comment));

	// Strip editor-namespace artifacts: cke_* classes and data-cke-* attributes.
	body.querySelectorAll('[class]').forEach((element) => {
		const kept = Array.from(element.classList).filter((cls) => !cls.startsWith('cke_'));
		if (kept.length) {
			element.setAttribute('class', kept.join(' '));
		} else {
			element.removeAttribute('class');
		}
	});
	body.querySelectorAll('*').forEach((element) => {
		Array.from(element.attributes)
			.filter((attribute) => attribute.name.startsWith('data-cke-'))
			.forEach((attribute) => element.removeAttribute(attribute.name));
	});

	// <font color face> → <span style="…"> (TextStyleKit parses the span).
	body.querySelectorAll('font').forEach((font) => {
		const span = doc.createElement('span');
		const styles: string[] = [];
		const color = font.getAttribute('color');
		const face = font.getAttribute('face');
		if (color) {
			styles.push(`color: ${color}`);
		}
		if (face) {
			styles.push(`font-family: ${face}`);
		}
		if (styles.length) {
			span.setAttribute('style', styles.join('; '));
		}
		while (font.firstChild) {
			span.appendChild(font.firstChild);
		}
		font.replaceWith(span);
	});

	// Deprecated align attribute → text-align style promotion (TextAlign parses the style).
	body.querySelectorAll('[align]').forEach((element) => {
		const align = element.getAttribute('align');
		element.removeAttribute('align');
		if (align && element instanceof HTMLElement && !element.style.textAlign) {
			element.style.textAlign = align;
		}
	});

	// <figure><img/><figcaption> → image + caption paragraph.
	body.querySelectorAll('figure').forEach((figure) => {
		const image = figure.querySelector('img');
		const caption = figure.querySelector('figcaption');
		if (image) {
			figure.before(image);
		}
		if (caption) {
			const paragraph = doc.createElement('p');
			const emphasis = doc.createElement('em');
			emphasis.innerHTML = caption.innerHTML;
			paragraph.appendChild(emphasis);
			figure.before(paragraph);
		}
		figure.remove();
	});

	// <p>&nbsp;</p> spacer paragraphs collapse to empty paragraphs.
	body.querySelectorAll('p').forEach((paragraph) => {
		if (paragraph.children.length === 0 && paragraph.textContent?.replace(/[\s ]+/g, '') === '') {
			paragraph.innerHTML = '';
		}
	});

	return body.innerHTML;
}
