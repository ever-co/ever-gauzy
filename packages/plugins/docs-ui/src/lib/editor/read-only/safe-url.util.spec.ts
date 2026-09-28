/**
 * The URL-scheme allowlist itself.
 *
 * `markdown-render.util.spec.ts` and `preview-media-url.spec.ts` test the two call sites; this
 * file tests the decision, including every obfuscation an "is it `javascript:`?" check misses:
 * case, leading whitespace and control characters, characters the URL parser strips from the
 * MIDDLE of a scheme, HTML entities (numeric, hex and named), and schemes nobody thought to
 * put on a denylist at all.
 */
import { isAllowedUrl, sanitizeMediaUrl, stripUnsafeUrls } from './safe-url.util';

/** Characters built from char codes so no invisible bytes live in this source file. */
const ch = (code: number) => String.fromCharCode(code);
const TAB = ch(0x09);
const LF = ch(0x0a);
const CR = ch(0x0d);
const NUL = ch(0x00);

/**
 * Shortest batch of calls the linearity tests time. One call on the smaller input can take well under a
 * millisecond, where timer noise is a large share of the reading, so calls are timed in batches and the
 * batch doubled until it runs at least this long. Every reading is then far above the timer's noise.
 */
const MIN_BATCH_MS = 50;

/**
 * Absolute ceiling for the FIRST (cold) rejection of the smaller hostile input. The growth ratio below is
 * the precise check; this one stops a validator that is linear but uniformly, grossly slow from passing
 * it. The old tests asserted 100 ms and 200 ms on exactly that single cold call, and the slowest CI reading
 * was 346 ms (two Jest projects side by side on a shared runner), so the ceiling sits about 9x above any
 * machine seen so far. Catastrophic backtracking at these sizes runs for seconds to minutes.
 */
const MAX_MS_PER_CALL = 3_000;

/**
 * Time per call of `isAllowedUrl(value)`, which must reject the value every time: the median of three
 * batches, each at least `MIN_BATCH_MS` long. Growing the batch also warms the JIT and the regexes before
 * the three measured batches run.
 */
function msPerCall(value: string): number {
	const timeBatch = (calls: number): number => {
		let allowed = false;
		const started = performance.now();
		for (let i = 0; i < calls; i++) {
			allowed = isAllowedUrl(value) || allowed;
		}
		const elapsed = performance.now() - started;
		expect(allowed).toBe(false);
		return elapsed;
	};
	let calls = 1;
	while (timeBatch(calls) < MIN_BATCH_MS) {
		calls *= 2;
	}
	const batches = [timeBatch(calls), timeBatch(calls), timeBatch(calls)].sort((a, b) => a - b);
	return batches[1] / calls;
}

/**
 * How much slower `isAllowedUrl` gets when its input grows fourfold: ~4 for linear work, 16 or more
 * for the catastrophic backtracking the linearity tests guard against.
 *
 * Those tests used to assert only an absolute wall-clock bound (`< 100 ms`, `< 200 ms`). That measured
 * the machine rather than the algorithm: in CI, with two Jest projects running side by side on the shared
 * runner pool, the linear entity case took 346 ms and failed on every run. A ratio of the same code on the
 * same machine moments apart cancels the machine out; `MAX_MS_PER_CALL` keeps a generous absolute bound.
 * Both sizes are timed the same way (`msPerCall`), and the ratio is taken as measured, with no floor.
 *
 * The ceiling is checked on ONE call, before anything else runs. A synchronous call cannot be interrupted
 * (Jest's timeout included), so a grossly slow validator is reported after that one call instead of after
 * the batches and the fourfold input have multiplied the wait. A call that never returns still ends in a
 * failure, never a pass: the job's own timeout stops it.
 */
function growthFactor(hostileOfLength: (n: number) => string, n: number): number {
	const smallValue = hostileOfLength(n);
	const started = performance.now();
	expect(isAllowedUrl(smallValue)).toBe(false);
	expect(performance.now() - started).toBeLessThan(MAX_MS_PER_CALL);

	const small = msPerCall(smallValue);
	const large = msPerCall(hostileOfLength(4 * n));
	return large / small;
}

describe('isAllowedUrl', () => {
	describe('allows what real content is made of', () => {
		it.each([
			'https://ever.co/docs?a=1#b',
			'http://ever.co',
			'HTTPS://EVER.CO',
			'mailto:ever@ever.co',
			'tel:+15551234',
			'blob:http://localhost/2b6f0cc9-04ba-4f2a-9f1e-2f2b0a1c1234',
			'/api/documents/1/raw',
			'./relative.png',
			'../up/one.png',
			'#anchor',
			'?query=1',
			'//cdn.ever.co/a.png',
			'a/b:c',
			'data:image/png;base64,iVBORw0KGgo=',
			'data:image/jpeg;base64,/9j/4AA',
			'data:image/gif,x',
			'data:image/webp;base64,UklGR'
		])('allows %s', (url) => {
			expect(isAllowedUrl(url)).toBe(true);
		});
	});

	describe('refuses every scheme outside the allowlist', () => {
		it.each([
			'javascript:alert(1)',
			'JavaScript:alert(1)',
			'JAVASCRIPT:alert(1)',
			'vbscript:msgbox(1)',
			'VBScript:msgbox(1)',
			'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
			'data:text/html,<script>alert(1)</script>',
			'data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E',
			'data:application/javascript,alert(1)',
			'data:,plain',
			'file:///etc/passwd',
			'about:blank',
			'chrome://settings',
			'ms-msdt:/id',
			'jar:http://evil/x!/y',
			'view-source:https://ever.co'
		])('refuses %s', (url) => {
			expect(isAllowedUrl(url)).toBe(false);
		});
	});

	describe('refuses javascript: however it is spelled', () => {
		it.each([
			['leading space', ' javascript:alert(1)'],
			['leading tab', `${TAB}javascript:alert(1)`],
			['leading newline', `${LF}javascript:alert(1)`],
			['leading CR', `${CR}javascript:alert(1)`],
			['leading NUL', `${NUL}javascript:alert(1)`],
			['tab inside the scheme', `jav${TAB}ascript:alert(1)`],
			['newline inside the scheme', `java${LF}script:alert(1)`],
			['decimal entity', '&#106;avascript:alert(1)'],
			['padded decimal entity', '&#0000106;avascript:alert(1)'],
			['hex entity', '&#x6a;avascript:alert(1)'],
			['uppercase hex entity', '&#X6A;avascript:alert(1)'],
			['entity without the semicolon', '&#106avascript:alert(1)'],
			['named Tab entity', 'jav&Tab;ascript:alert(1)'],
			['named colon entity', 'javascript&colon;alert(1)'],
			['mixed case with padding', `  ${TAB}JaVaScRiPt:alert(1)`]
		])('refuses %s', (_label, url) => {
			expect(isAllowedUrl(url)).toBe(false);
		});
	});

	it('refuses an absent or empty value', () => {
		expect(isAllowedUrl(null)).toBe(false);
		expect(isAllowedUrl(undefined)).toBe(false);
		expect(isAllowedUrl('')).toBe(false);
		expect(isAllowedUrl(`  ${TAB}${LF}  `)).toBe(false);
	});

	it('is linear on a long value (no catastrophic backtracking)', () => {
		const hostile = (n: number) => `data:text/html;base64,${'A'.repeat(n)}`;

		// Linear is ~4; quadratic would be ~16.
		expect(growthFactor(hostile, 400_000)).toBeLessThan(10);
	}, 60_000);

	it('is linear on a long run of entities', () => {
		const hostile = (n: number) => `${'&#106;'.repeat(n)}avascript:alert(1)`;

		// Linear is ~4; quadratic would be ~16.
		expect(growthFactor(hostile, 60_000)).toBeLessThan(10);
	}, 60_000);
});

describe('stripUnsafeUrls', () => {
	const parse = (html: string): HTMLElement => {
		const host = document.createElement('div');
		host.innerHTML = html;
		return host;
	};

	it('removes a dangerous href but keeps the element and its text', () => {
		const dom = parse(stripUnsafeUrls('<p><a href="vbscript:msgbox(1)">click</a></p>'));

		expect(dom.querySelector('a')?.hasAttribute('href')).toBe(false);
		expect(dom.textContent).toBe('click');
	});

	it('leaves safe URLs exactly as they were', () => {
		const html = '<a href="https://ever.co/a?b=1#c">x</a><img src="/api/documents/1/raw" alt="a">';

		expect(parse(stripUnsafeUrls(html)).querySelector('a')?.getAttribute('href')).toBe('https://ever.co/a?b=1#c');
		expect(parse(stripUnsafeUrls(html)).querySelector('img')?.getAttribute('src')).toBe('/api/documents/1/raw');
	});

	it('checks every URL-bearing attribute, not just href and src', () => {
		const dom = parse(
			stripUnsafeUrls(
				'<blockquote cite="javascript:alert(1)">q</blockquote>' +
					'<video poster="data:text/html,x" src="blob:http://localhost/1"></video>'
			)
		);

		expect(dom.querySelector('blockquote')?.hasAttribute('cite')).toBe(false);
		expect(dom.querySelector('video')?.hasAttribute('poster')).toBe(false);
		expect(dom.querySelector('video')?.getAttribute('src')).toBe('blob:http://localhost/1');
	});

	it('is idempotent', () => {
		const once = stripUnsafeUrls('<a href="vbscript:msgbox(1)">c</a><a href="https://ever.co">d</a>');

		expect(stripUnsafeUrls(once)).toBe(once);
	});

	it('cannot be defeated by nesting, because it parses instead of pattern-matching', () => {
		// A string sanitizer that deleted `<script…>` would splice `<scr` to `ipt>` here.
		const dom = parse(stripUnsafeUrls('<p>a<scr<style>ipt>alert(1)</p>'));

		expect(dom.querySelector('script')).toBeNull();
	});
});

describe('sanitizeMediaUrl', () => {
	it('returns the URL when the scheme is allowed and null when it is not', () => {
		expect(sanitizeMediaUrl('blob:http://localhost/abc')).toBe('blob:http://localhost/abc');
		expect(sanitizeMediaUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
	});
});
