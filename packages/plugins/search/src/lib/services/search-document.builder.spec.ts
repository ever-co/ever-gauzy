import { readPath, renderTemplate, SearchSourceRow, toSearchText } from './search-document.builder';

/**
 * How a `{{path}}` title template is read.
 *
 * The template used to be read with two expressions that cost more than linear time on text an
 * administrator writes: `/\{\{\s*([^}]+?)\s*\}\}/g`, whose leading whitespace and lazy body overlap — a
 * template opening `{{` on five thousand spaces took more than eighty seconds — and
 * `/\s*(?:[—–\-|,;:]\s*)+$/`, anchored only at its end. Both are now plain scans. The reference below
 * is the previous implementation, verbatim, and the suite holds the scans to it: on the cases a person
 * writes, and on a few thousand generated templates, the two render the same title.
 */

/** The previous implementation, verbatim, for comparison on short inputs only. */
function previousRenderTemplate(template: string, row: SearchSourceRow): string {
	const LEADING_SEPARATOR = /^(?:\s*[—–\-|,;:])+\s*/;
	const TRAILING_SEPARATOR = /\s*(?:[—–\-|,;:]\s*)+$/;
	const source = String(template ?? '');
	const pieces: Array<{ text: string; placeholder: boolean }> = [];
	let cursor = 0;

	for (const match of source.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
		const at = match.index ?? 0;

		pieces.push({ text: source.slice(cursor, at), placeholder: false });
		pieces.push({ text: toSearchText(readPath(row, match[1])), placeholder: true });
		cursor = at + match[0].length;
	}

	pieces.push({ text: source.slice(cursor), placeholder: false });

	const emptied = pieces.map((piece) => piece.placeholder && !piece.text);
	const rendered = pieces.map((piece, index) => {
		if (piece.placeholder) {
			return piece.text;
		}

		let text = piece.text;

		if (emptied[index - 1]) {
			text = text.replace(LEADING_SEPARATOR, ' ');
		}

		if (emptied[index + 1]) {
			text = text.replace(TRAILING_SEPARATOR, ' ');
		}

		return text;
	});

	return String(rendered.join('') ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** A deterministic generator, so a failure names a template that can be replayed. */
function generator(seed: number): () => number {
	let state = seed >>> 0;

	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;

		return state / 0x100000000;
	};
}

const ROW: SearchSourceRow = {
	name: 'Widget',
	code: 'W-1',
	empty: '',
	nested: { title: 'Inner' },
	list: [{ label: '' }, { label: 'Second' }],
	' ': 'space key',
	'{a': 'brace key'
};

describe('renderTemplate — the title a template renders', () => {
	it.each([
		['{{name}} — {{code}}', 'Widget — W-1'],
		['{{name}} — {{missing}}', 'Widget'],
		['{{missing}} — {{code}}', 'W-1'],
		['{{ name }}, {{ nested.title }}', 'Widget, Inner'],
		['{{list.label}}', 'Second'],
		['{{name}} | {{empty}} | {{code}}', 'Widget W-1'],
		['{{}} {{name}}', '{{}} Widget'],
		['{{ }}', 'space key'],
		['{{{a}}', 'brace key'],
		['{{name} — {{code}}', '{{name} — W-1'],
		['{{name}', '{{name}'],
		['plain text', 'plain text']
	])('renders %j as %j', (template, title) => {
		expect(renderTemplate(template, ROW)).toBe(title);
		expect(previousRenderTemplate(template, ROW)).toBe(title);
	});

	it('renders what the previous implementation rendered, on generated templates', () => {
		// Built from the characters the two expressions branch on — braces, whitespace, every separator —
		// and from paths that resolve, resolve to nothing, and do not exist.
		const alphabet = [
			'{{',
			'}}',
			'{',
			'}',
			' ',
			'\t',
			'\n',
			'name',
			'code',
			'empty',
			'missing',
			'.',
			'—',
			'–',
			'-',
			'|',
			',',
			';',
			':',
			'x'
		];
		const random = generator(20261009);

		for (let run = 0; run < 5000; run += 1) {
			const length = Math.floor(random() * 14);
			let template = '';

			for (let index = 0; index < length; index += 1) {
				template += alphabet[Math.floor(random() * alphabet.length)];
			}

			expect([template, renderTemplate(template, ROW)]).toEqual([
				template,
				previousRenderTemplate(template, ROW)
			]);
		}
	});

	it('reads an unclosed placeholder over a long run of whitespace in linear time', () => {
		// Measured on Node with the previous expression: `{{` and 5 000 spaces took 83 s.
		const unclosed = `${'{{ '.repeat(50_000)}}`;
		const started = Date.now();

		expect(renderTemplate(`{{${' '.repeat(200_000)}`, ROW)).toBe('{{');
		// Fifty thousand `{{` that all end at the one lone `}`: each fails the same way, so the scan skips
		// past it once instead of re-reading the text from every `{{`.
		expect(renderTemplate(unclosed, ROW)).toBe(unclosed);
		expect(Date.now() - started).toBeLessThan(2_000);
	});

	it('drops a long separator run before an empty placeholder in linear time', () => {
		// The trailing-separator expression is anchored only at the end, so on a run that does not reach the
		// end of the literal text it restarted at every character of the run.
		const started = Date.now();

		expect(renderTemplate(`{{name}}${','.repeat(100_000)}x{{missing}}`, ROW)).toBe(`Widget${','.repeat(100_000)}x`);
		expect(renderTemplate(`{{name}}${' '.repeat(100_000)}x{{missing}}`, ROW)).toBe('Widget x');
		expect(renderTemplate(`{{name}} ,${' ,'.repeat(100_000)}{{missing}}`, ROW)).toBe('Widget');
		expect(Date.now() - started).toBeLessThan(2_000);
	});
});
