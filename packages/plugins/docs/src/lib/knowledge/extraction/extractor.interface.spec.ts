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
import { normalizeMarkdown } from './extractor.interface';

/** Characters built from char codes so no invisible bytes live in this source file. */
const ch = (code: number) => String.fromCharCode(code);
const NUL = ch(0x00);
const BOM = ch(0xfeff);
const VERTICAL_TAB = ch(0x0b);
const FORM_FEED = ch(0x0c);

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
