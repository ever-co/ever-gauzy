'use strict';

/**
 * Makes the latest-mac.yml of one GitHub release declare minimumSystemVersion (see action.yml for why).
 *
 * Runs inside actions/github-script, which passes its authenticated Octokit client and @actions/core.
 * The edit is applied without ever leaving the release without a manifest it can fall back to:
 *
 *   1. upload the edited manifest under a staging name,
 *   2. delete the original latest-mac.yml,
 *   3. rename the staged asset to latest-mac.yml,
 *
 * and then the next pass re-reads the release and verifies the result. Every pass starts from what the
 * release holds, so a pass interrupted between any two calls is completed by the next one (a staged
 * asset with no latest-mac.yml beside it is renamed; a stale staged asset is replaced).
 */

const fs = require('node:fs');
const path = require('node:path');
const { KEY, assertMinimum, ensureMinimumSystemVersion, resolveTarget } = require('./manifest.cjs');

const MANIFEST = 'latest-mac.yml';
const STAGED = 'latest-mac.yml.staged';
const MAX_FAILURES = 5;
const MAX_PASSES = 10;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Network errors, timeouts, 404/409/422 races, rate limits and 5xx are worth another pass; 401/403 are not. */
function isRetryable(error) {
	if (error.fatal) return false;
	const status = error.status;
	if (!status) return true;
	if (status === 403) return /rate limit/i.test(error.message || '');
	return [404, 408, 409, 422, 429].includes(status) || status >= 500;
}

/** The release by tag; drafts and bare-version tags (which electron-builder's own lookup also matches) via the list. */
async function findRelease(github, { owner, repo, tag }) {
	try {
		const { data } = await github.rest.repos.getReleaseByTag({ owner, repo, tag });
		return data;
	} catch (error) {
		if (error.status !== 404) throw error;
	}
	const version = tag.replace(/^v/, '');
	const { data } = await github.rest.repos.listReleases({ owner, repo, per_page: 100 });
	const release = data.find((candidate) => candidate.tag_name === tag || candidate.tag_name === version);
	if (!release) {
		throw Object.assign(new Error(`There is no release ${tag} in ${owner}/${repo}.`), { status: 404 });
	}
	return release;
}

/** The asset's bytes as UTF-8 text; a short read is an error, never a manifest. */
async function download(github, { owner, repo }, asset) {
	const { data } = await github.rest.repos.getReleaseAsset({
		owner,
		repo,
		asset_id: asset.id,
		headers: { accept: 'application/octet-stream' }
	});
	let bytes;
	if (typeof data === 'string') bytes = Buffer.from(data, 'utf8');
	else if (data instanceof ArrayBuffer) bytes = Buffer.from(data);
	else if (ArrayBuffer.isView(data)) bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	else throw new Error(`Unexpected ${typeof data} body downloading ${asset.name}.`);
	if (typeof asset.size === 'number' && bytes.length !== asset.size) {
		throw new Error(`Downloaded ${bytes.length} bytes of ${asset.name}, expected ${asset.size}.`);
	}
	return bytes.toString('utf8');
}

/**
 * @param args `{ github, core, env, sleep }`; `env` and `sleep` default to process.env and setTimeout.
 * @returns `{ skipped }`, or `{ changed, previous, text }` once the release's manifest is verified.
 */
module.exports = async function run({ github, core, env = process.env, sleep = defaultSleep }) {
	const minimum = (env.MINIMUM_SYSTEM_VERSION || '').trim();
	assertMinimum(minimum);

	const packagePath = (env.APP_PACKAGE_JSON || '').trim();
	const appPackage = packagePath ? JSON.parse(fs.readFileSync(path.resolve(packagePath), 'utf8')) : null;
	const target = resolveTarget({
		owner: (env.RELEASE_OWNER || '').trim(),
		repo: (env.RELEASE_REPO || '').trim(),
		tag: env.RELEASE_TAG,
		appPackage
	});
	if (target.skip) {
		core.notice(target.skip);
		return { skipped: true };
	}

	const { owner, repo, tag } = target;
	const where = `${owner}/${repo} release ${tag}`;
	let release = null;
	let failures = 0;
	let changed = false;
	let previous = null;

	for (let pass = 1; pass <= MAX_PASSES; pass++) {
		try {
			release ??= await findRelease(github, target);
			const assets = await github.paginate(github.rest.repos.listReleaseAssets, {
				owner,
				repo,
				release_id: release.id,
				per_page: 100
			});
			const manifest = assets.find((asset) => asset.name === MANIFEST);
			const staged = assets.find((asset) => asset.name === STAGED);

			if (!manifest) {
				if (staged) {
					// An earlier pass uploaded the edited manifest and deleted the original, then stopped.
					core.info(`Completing an interrupted swap: renaming ${STAGED} to ${MANIFEST} in ${where}.`);
					await github.rest.repos.updateReleaseAsset({ owner, repo, asset_id: staged.id, name: MANIFEST });
					changed = true;
					continue;
				}
				throw new Error(`${MANIFEST} is not among the ${assets.length} assets of ${where}; electron-builder should have published it.`);
			}

			const text = await download(github, target, manifest);
			let result;
			try {
				result = ensureMinimumSystemVersion(text, minimum);
			} catch (error) {
				error.fatal = true;
				throw error;
			}

			if (!result.changed) {
				if (staged) {
					await github.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: staged.id });
				}
				const declared = /^minimumSystemVersion:.*$/m.exec(text)[0].trim();
				core.startGroup(`${MANIFEST} of ${where}`);
				core.info(text);
				core.endGroup();
				if (changed) {
					core.notice(`${MANIFEST} of ${where} now declares '${declared}'${previous ? ` (was ${previous})` : ''}.`);
				} else {
					core.info(`${MANIFEST} of ${where} already declares '${declared}'; nothing to do.`);
				}
				return { changed, previous, text };
			}

			if (staged) {
				// Left by an interrupted earlier pass, and possibly built from an older manifest.
				await github.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: staged.id });
			}
			const { data: uploaded } = await github.rest.repos.uploadReleaseAsset({
				owner,
				repo,
				release_id: release.id,
				name: STAGED,
				data: Buffer.from(result.text, 'utf8'),
				headers: { 'content-type': manifest.content_type || 'application/octet-stream' }
			});
			await github.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: manifest.id });
			await github.rest.repos.updateReleaseAsset({ owner, repo, asset_id: uploaded.id, name: MANIFEST });
			changed = true;
			previous = result.previous;
			core.info(`Replaced ${MANIFEST} of ${where} (asset ${manifest.id} -> ${uploaded.id}); verifying.`);
		} catch (error) {
			if (!isRetryable(error)) throw error;
			failures++;
			core.info(`Attempt ${failures}/${MAX_FAILURES} on ${where} failed: ${error.status || 'no status'} ${error.message}`);
			if (failures >= MAX_FAILURES) {
				throw new Error(`Could not make ${MANIFEST} of ${where} declare ${KEY} ${minimum}: ${error.message}`);
			}
			await sleep(failures * 5000);
		}
	}
	throw new Error(`${MANIFEST} of ${where} did not settle after ${MAX_PASSES} passes; something else keeps replacing it.`);
};

module.exports.MANIFEST = MANIFEST;
module.exports.STAGED = STAGED;
