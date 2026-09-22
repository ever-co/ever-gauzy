#!/usr/bin/env node
/**
 * Mirror desktop-app release assets from GitHub Releases into the Cloudflare R2 bucket behind
 * https://downloads.ever.co, and publish a manifest of what is actually there.
 *
 * Why this exists: the download links on gauzy.co pointed at
 * `ever.sfo3.cdn.digitaloceanspaces.com`, which died with the DigitalOcean account. GitHub Releases
 * stays the source of truth and the auto-update feed; R2 is a mirror in front of it, so a mirror
 * miss degrades to a working GitHub link instead of a broken download.
 *
 * The manifest is the contract. The website rewrites a GitHub asset URL to downloads.ever.co ONLY
 * for keys listed in manifest.json, so a release that has not been mirrored yet still downloads from
 * GitHub rather than 404ing. Never add a manifest entry for an object you have not read back.
 *
 * Zero dependencies on purpose: SigV4 is implemented here rather than pulling an SDK or assuming the
 * AWS CLI exists, so this behaves identically on GitHub-hosted and self-hosted ARC runners.
 *
 * Env: R2_BUCKET R2_S3_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY [GITHUB_TOKEN] [DRY_RUN]
 */
import crypto from 'node:crypto';

const ENDPOINT = process.env.R2_S3_ENDPOINT;
const BUCKET = process.env.R2_BUCKET;
const AKID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const DRY = process.env.DRY_RUN === 'true';

for (const [k, v] of Object.entries({
	R2_S3_ENDPOINT: ENDPOINT,
	R2_BUCKET: BUCKET,
	R2_ACCESS_KEY_ID: AKID,
	R2_SECRET_ACCESS_KEY: SECRET
})) {
	if (!v) {
		console.error(`missing env ${k}`);
		process.exit(2);
	}
}

/** GitHub repo -> object-key prefix. Must stay in step with `switchToCDN` in ever-gauzy-website. */
const APPS = {
	'ever-gauzy-desktop': 'gauzy-desktop',
	'ever-gauzy-desktop-timer': 'gauzy-desktop-timer',
	'ever-gauzy-server': 'gauzy-server',
	'ever-gauzy-agent': 'gauzy-agent'
};

// Installers only. Mirroring the update metadata (latest*.yml) would turn R2 into an update feed,
// and the auto-updater must keep talking to GitHub.
const ASSET_RE = /\.(exe|dmg|deb|rpm|AppImage|zip|snap|pkg|msi)$/i;

const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();

/**
 * Make a remote-derived string safe to print.
 *
 * Release tags, asset names and error bodies all come from outside this script. Printed raw, a
 * newline or carriage return in one of them can forge additional log lines in the CI output.
 */
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f]', 'g');
const safe = (v) => String(v).replace(CONTROL_CHARS, ' ').slice(0, 200);

function sign({ method, key, payloadHash, extra = {} }) {
	const url = new URL(`${ENDPOINT}/${BUCKET}/${key}`);
	const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
	const date = amzDate.slice(0, 8);

	const headers = {
		host: url.host,
		'x-amz-content-sha256': payloadHash,
		'x-amz-date': amzDate,
		...extra
	};
	const lower = {};
	for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = String(v).trim();
	// SigV4 requires the signed-header list in byte order, so compare code units directly.
	// 🛑 Do NOT switch this to localeCompare: it is locale-aware and would order some headers
	// differently from what the server canonicalises, producing SignatureDoesNotMatch.
	const byByte = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
	const names = Object.keys(lower).sort(byByte);

	const canonicalRequest = [
		method,
		url.pathname
			.split('/')
			.map((s) => encodeURIComponent(decodeURIComponent(s)))
			.join('/'),
		'',
		names.map((n) => `${n}:${lower[n]}\n`).join(''),
		names.join(';'),
		payloadHash
	].join('\n');

	const scope = `${date}/auto/s3/aws4_request`;
	const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(Buffer.from(canonicalRequest))].join('\n');
	const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, date), 'auto'), 's3'), 'aws4_request');
	const signature = crypto.createHmac('sha256', signingKey).update(toSign).digest('hex');

	headers.Authorization = `AWS4-HMAC-SHA256 Credential=${AKID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
	return { url: url.toString(), headers };
}

async function head(key) {
	const { url, headers } = sign({ method: 'HEAD', key, payloadHash: sha256hex(Buffer.alloc(0)) });
	const r = await fetch(url, { method: 'HEAD', headers });
	return { exists: r.ok, size: r.ok ? Number(r.headers.get('content-length') || 0) : 0 };
}

async function put(key, body, contentType) {
	const { url, headers } = sign({
		method: 'PUT',
		key,
		payloadHash: sha256hex(body),
		extra: { 'content-type': contentType, 'content-length': String(body.length) }
	});
	const r = await fetch(url, { method: 'PUT', headers, body });
	if (!r.ok) throw new Error(`PUT ${key} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
}

async function gh(path) {
	const r = await fetch(`https://api.github.com${path}`, {
		headers: {
			Accept: 'application/vnd.github+json',
			'User-Agent': 'ever-r2-mirror',
			...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {})
		}
	});
	if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
	return r.json();
}

// `--selftest` proves the SigV4 implementation against the real bucket before anyone depends on it.
// A HEAD alone cannot do that: R2 answers both "absent" and "signature rejected" in a way this script
// reads as absent, so a signing bug would look exactly like an empty mirror and the job would happily
// publish an empty manifest. Round-tripping a real object is the only honest check.
if (process.argv.includes('--selftest')) {
	const key = `_selftest/${Date.now()}.txt`;
	const body = Buffer.from(`signing round-trip ${new Date().toISOString()}\n`);
	try {
		await put(key, body, 'text/plain');
		const back = await head(key);
		if (!back.exists || back.size !== body.length) {
			throw new Error(`read-back mismatch: exists=${back.exists} size=${back.size} want=${body.length}`);
		}
		console.log(`selftest OK: signed PUT + HEAD round-tripped ${key} (${body.length} bytes)`);
		process.exit(0);
	} catch (e) {
		console.error(`selftest FAILED: ${safe(e.message)}`);
		process.exit(1);
	}
}

const mirrored = [];
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const [repo, prefix] of Object.entries(APPS)) {
	let releases;
	try {
		releases = await gh(`/repos/ever-co/${repo}/releases?per_page=20`);
	} catch (e) {
		console.error(`  ${repo}: cannot list releases -- ${safe(e.message)}`);
		failed++;
		continue;
	}

	// The site only ever links to the newest stable and the newest prerelease, so those two are
	// sufficient. Older versions keep resolving to GitHub through the manifest fallback.
	const targets = [
		{ rel: releases.find((r) => !r.prerelease && !r.draft), dir: prefix },
		{ rel: releases.find((r) => r.prerelease && !r.draft), dir: `${prefix}-pre` }
	];

	for (const { rel, dir } of targets) {
		if (!rel) {
			console.log(`  ${dir}: no release found`);
			continue;
		}
		console.log(`  ${dir}: ${safe(rel.tag_name)} (${rel.assets.length} assets)`);

		for (const asset of rel.assets) {
			if (!ASSET_RE.test(asset.name)) continue;
			const key = `${dir}/${asset.name}`;
			const mb = Math.round(asset.size / 1048576);
			try {
				const existing = await head(key);
				if (existing.exists && existing.size === asset.size) {
					mirrored.push(key);
					skipped++;
					continue;
				}
				if (DRY) {
					console.log(`    would upload ${safe(key)} (${mb}MB)`);
					continue;
				}

				const dl = await fetch(asset.browser_download_url, {
					headers: {
						'User-Agent': 'ever-r2-mirror',
						...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {})
					},
					redirect: 'follow'
				});
				if (!dl.ok) throw new Error(`download ${dl.status}`);
				const buf = Buffer.from(await dl.arrayBuffer());
				if (buf.length !== asset.size) {
					throw new Error(`size mismatch: got ${buf.length}, expected ${asset.size}`);
				}

				await put(key, buf, asset.content_type || 'application/octet-stream');

				// Only trust the mirror after reading it back at the expected size.
				const verify = await head(key);
				if (!verify.exists || verify.size !== asset.size) {
					throw new Error(`post-upload verify failed (${verify.size} != ${asset.size})`);
				}

				mirrored.push(key);
				uploaded++;
				console.log(`    uploaded ${safe(key)} (${mb}MB)`);
			} catch (e) {
				failed++;
				console.error(`    FAILED ${safe(key)}: ${safe(e.message)}`);
			}
		}
	}
}

if (!DRY) {
	const manifest = {
		generated: new Date().toISOString(),
		base: 'https://downloads.ever.co',
		// Byte order, and a copy rather than sorting `mirrored` in place.
		keys: [...mirrored].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
	};
	await put('manifest.json', Buffer.from(JSON.stringify(manifest, null, 1)), 'application/json');
	console.log(`\nmanifest.json published with ${mirrored.length} keys`);
}

console.log(`\nuploaded=${uploaded} already-present=${skipped} failed=${failed}`);

// A failure must fail the job. A silently-partial mirror is how the site ends up advertising a file
// that is not there.
process.exit(failed ? 1 : 0);
