import { createHash } from 'node:crypto';

/**
 * The landing page of a workspace request from Ever: `GET /api/ever-connect/provision#intent=<JWS>`.
 *
 * The request rides in the URL fragment, which a browser never sends to a server, so it is in no
 * server or proxy log. The page reads it, removes it from the address bar and the history at once,
 * sends it to `POST …/provision/preflight` (which verifies it and answers a one-time key), then opens
 * the Ever ID sign-in with that key. Nothing else: no third-party host, no stored data, no inline
 * code other than the script and style below (allowed by their digests only).
 */

const STYLE = [
	'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f7f7fb;color:#1f2937}',
	'main{max-width:28rem;margin:18vh auto 0;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}',
	'h1{font-size:1.25rem;margin:0 0 .75rem}',
	'p{margin:.5rem 0;line-height:1.5}',
	'a{color:#3366ff}'
].join('');

/** Uses no network API but the page's own `XMLHttpRequest` to the same origin. */
const SCRIPT = `(function () {
	var status = document.getElementById('status');
	var back = document.getElementById('back');
	function fail(text) {
		status.textContent = text;
		back.hidden = false;
	}
	var match = /^#intent=([A-Za-z0-9_.-]{1,65536})$/.exec(window.location.hash || '');
	var path = window.location.pathname.replace(/\\/+$/, '');
	try {
		window.history.replaceState(null, '', path);
	} catch (e) {
		window.location.hash = '';
	}
	if (!match) {
		fail('This link is not complete. Start again from Ever.');
		return;
	}
	var request = new XMLHttpRequest();
	request.open('POST', path + '/preflight');
	request.setRequestHeader('Content-Type', 'application/json');
	request.onload = function () {
		var body = null;
		try {
			body = JSON.parse(request.responseText);
		} catch (e) {
			body = null;
		}
		if (request.status === 200 && body && typeof body.provision_key === 'string') {
			var signIn = path.replace(/\\/ever-connect\\/provision$/, '/auth/zitadel');
			window.location.replace(signIn + '?provision=' + encodeURIComponent(body.provision_key));
			return;
		}
		if (request.status === 404) {
			fail('Creating a workspace from Ever is not available on this installation.');
		} else if (request.status === 409) {
			fail('This link was already used. Start again from Ever.');
		} else if (request.status === 429) {
			fail('Too many attempts. Wait a minute, then open the link again.');
		} else {
			fail('This link is not valid any more. Start again from Ever.');
		}
	};
	request.onerror = function () {
		fail('Ever Gauzy could not be reached. Check your connection and open the link again.');
	};
	request.send(JSON.stringify({ intent: match[1] }));
})();`;

const digest = (text: string): string => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** The page. */
export const PROVISION_LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>Ever Gauzy</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Creating your workspace</h1>
<p id="status" role="status">One moment, taking you to Sign in with Ever ID…</p>
<p id="back" hidden><a href="https://app.ever.co/" rel="noreferrer">Back to Ever</a></p>
</main>
<script>${SCRIPT}</script>
</body>
</html>
`;

/** The page's headers: never cached or referred, and it may run its own script only. */
export const PROVISION_LANDING_HEADERS: Readonly<Record<string, string>> = Object.freeze({
	'Content-Type': 'text/html; charset=utf-8',
	'Cache-Control': 'no-store',
	'Referrer-Policy': 'no-referrer',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Content-Security-Policy': [
		"default-src 'none'",
		`script-src ${digest(SCRIPT)}`,
		`style-src ${digest(STYLE)}`,
		"connect-src 'self'",
		"base-uri 'none'",
		"form-action 'none'",
		"frame-ancestors 'none'"
	].join('; ')
});
