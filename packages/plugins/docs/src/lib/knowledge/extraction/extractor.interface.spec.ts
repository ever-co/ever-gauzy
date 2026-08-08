/**
 * `normalizeMarkdown` runs on the output of EVERY extractor, i.e. on the text of every
 * uploaded document, on the request thread.
 *
 * Its trailing-whitespace pass used to be `/[ \t]+$/gm`, which restarts the trailing-run
 * match at every position inside a run of spaces. That is quadratic, and it was by a wide
 * margin the most exploitable pattern in the plugin: a single long line of spaces in an
 * uploaded file cost ~19s for an 80 KB run measured locally, and nothing about a file of
 * spaces looks hostile. It is now a line-wise backwards walk.
 *
 * These tests pin both halves of that change: the normalization semantics are unchanged
 * (only spaces and tabs go, and only from the end of a line), and the cost stays linear.
 */
import { escapeTableCell, normalizeMarkdown } from './extractor.interface';

/** Characters built from char codes so no invisible bytes live in this source file. */
const ch = (code: number) => String.fromCharCode(code);
const NUL = ch(0x00);
const BOM = ch(0xfeff);
const VERTICAL_TAB = ch(0x0b);
const FORM_FEED = ch(0x0c);
const CR = ch(0x0d);
const LINE_SEPARATOR = ch(0x2028);
const PARAGRAPH_SEPARATOR = ch(0x2029);

describe('normalizeMarkdown', () => {
	it('strips a leading BOM and every NUL byte', () => {
		expect(normalizeMarkdown(`${BOM}a${NUL}b${NUL}`)).toBe('ab');
	});

	it('converts CRLF and lone CR to LF', () => {
		expect(normalizeMarkdown('a\r\nb\rc')).toBe('a\nb\nc');
	});

	it('trims trailing spaces and tabs from every line', () => {
		expect(normalizeMarkdown('a  \nb\t\t\nc   ')).toBe('a\nb\nc');
	});

	it('keeps LEADING whitespace, which is markdown-significant', () => {
		// Indented code blocks and nested list items depend on it.
		expect(normalizeMarkdown('a\n    indented  \n\ttabbed\t')).toBe('a\n    indented\n\ttabbed');
	});

	it('leaves interior whitespace alone', () => {
		expect(normalizeMarkdown('a  b\tc')).toBe('a  b\tc');
	});

	it('does NOT strip vertical tab or form feed, which the original pattern preserved', () => {
		// `trimEnd()` would have removed these — the line walk deliberately does not.
		expect(normalizeMarkdown(`a${VERTICAL_TAB}\nb${FORM_FEED}\nc`)).toBe(
			`a${VERTICAL_TAB}\nb${FORM_FEED}\nc`
		);
	});

	it('tolerates null and undefined', () => {
		expect(normalizeMarkdown(null as unknown as string)).toBe('');
		expect(normalizeMarkdown(undefined as unknown as string)).toBe('');
	});

	it('normalizes a long run of whitespace in linear time (ReDoS regression)', () => {
		// The exact shape that used to stall: one enormous line of spaces.
		const hostile = `heading\n${' '.repeat(400_000)}\ntail`;

		const started = Date.now();
		const result = normalizeMarkdown(hostile);
		const elapsed = Date.now() - started;

		expect(elapsed).toBeLessThan(100);
		expect(result).toBe('heading\n\ntail');
	});

	it('stays linear when the whitespace run does not end its line', () => {
		// Trailing content after the run is what forced the old pattern to retry every offset.
		const hostile = `${' '.repeat(400_000)}x`;

		const started = Date.now();
		const result = normalizeMarkdown(hostile);
		const elapsed = Date.now() - started;

		expect(elapsed).toBeLessThan(100);
		// `.trim()` removes the leading run; the `x` survives.
		expect(result).toBe('x');
	});
});

/**
 * `escapeTableCell` is the ONLY thing standing between an attacker-supplied cell value and the
 * structure of the pipe table every table-producing extractor (CSV, XLSX, DOCX, HTML) emits.
 *
 * It escaped `|` with a backslash but never escaped the backslash itself, so `\|` in the source
 * data came out as `\\|` — which markdown reads as "an escaped backslash, then a LIVE cell
 * separator" (CodeQL `js/incomplete-sanitization`). It also only removed `\r\n`/`\n`, leaving a
 * lone `\r` — a line ending in CommonMark — free to split the row.
 */
describe('escapeTableCell', () => {
	/**
	 * Counts pipes that markdown would read as cell separators: a backslash escapes exactly the
	 * character that follows it, so a pipe is live only when an even number of backslashes
	 * precedes it. This is the property that matters, rather than the exact escaped spelling.
	 */
	const liveSeparators = (cell: string): number => {
		let count = 0;
		for (let index = 0; index < cell.length; index++) {
			if (cell[index] === '\\') {
				index++; // the next character is escaped, whatever it is
				continue;
			}
			if (cell[index] === '|') {
				count++;
			}
		}
		return count;
	};

	it('escapes a plain pipe', () => {
		expect(liveSeparators(escapeTableCell('a|b'))).toBe(0);
	});

	it('escapes the backslash, so a pre-escaped pipe cannot re-open the cell', () => {
		// Source value: a \ | b. The old output `a\\|b` renders as a literal backslash followed
		// by a real column break — one crafted cell silently restructured the whole table.
		expect(liveSeparators(escapeTableCell('a\\|b'))).toBe(0);
	});

	it('escapes a trailing backslash, which would otherwise escape the cell delimiter itself', () => {
		// Rendered as `| a\ |`, the trailing backslash escapes the table's own closing pipe.
		expect(escapeTableCell('a\\').endsWith('\\\\')).toBe(true);
	});

	it('removes every line ending, not just \\n and \\r\\n', () => {
		const escaped = escapeTableCell(`a${CR}b\nc\r\nd${LINE_SEPARATOR}e${PARAGRAPH_SEPARATOR}f`);

		expect(escaped).not.toContain(CR);
		expect(escaped).not.toContain('\n');
		expect(escaped).not.toContain(LINE_SEPARATOR);
		expect(escaped).not.toContain(PARAGRAPH_SEPARATOR);
		expect(escaped).toContain('a b c d e f');
	});

	it('leaves ordinary text untouched', () => {
		expect(escapeTableCell('  plain value  ')).toBe('plain value');
		expect(escapeTableCell(null as unknown as string)).toBe('');
		expect(escapeTableCell(undefined as unknown as string)).toBe('');
	});
});
