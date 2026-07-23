const fs = require('fs');
const simpleGit = require('simple-git');
const git = simpleGit();

async function getLatestTag(repoURL) {
	try {
		// Fetch remote tags
		const tags = await git.listRemote(['--tags', repoURL]);

		// Parse and filter tags
		const tagPattern = /^v[0-9]+\.[0-9]+\.[0-9]+$/;
		const tagList = tags
			.split('\n')
			.map((tagLine) => tagLine.split(/\s+/)[1]) // Extract the tag reference
			.filter((ref) => ref && ref.includes('refs/tags/')) // Filter out non-tags
			.map((ref) => ref.replace('refs/tags/', '')) // Extract the tag name
			.filter((tag) => tagPattern.test(tag)); // Filter valid version tags

		// Sort and get the latest tag
		const latestTag = tagList
			.sort((a, b) => {
				// Using localeCompare with 'numeric' option for version comparison
				return a.localeCompare(b, undefined, { numeric: true });
			})
			.pop();

		return latestTag;
	} catch (error) {
		console.error(`Error fetching tags: ${error.message}`);
	}
}

async function getTagForCommit(repoURL, sha) {
	const tags = await git.listRemote(['--tags', repoURL]);

	const tagPattern = /^v[0-9]+\.[0-9]+\.[0-9]+$/;

	// Map tag name -> commit sha. Annotated tags list both the tag object sha and a
	// peeled 'refs/tags/<name>^{}' line with the commit sha - the peeled sha wins.
	const tagCommits = {};
	for (const tagLine of tags.split('\n')) {
		const [tagSha, ref] = tagLine.split(/\s+/);
		if (!tagSha || !ref || !ref.startsWith('refs/tags/')) continue;
		let name = ref.replace('refs/tags/', '');
		const peeled = name.endsWith('^{}');
		if (peeled) name = name.slice(0, -3);
		if (!tagPattern.test(name)) continue;
		if (peeled || !(name in tagCommits)) tagCommits[name] = tagSha;
	}

	const matches = Object.keys(tagCommits).filter((name) => tagCommits[name] === sha);
	return matches
		.sort((a, b) => {
			return a.localeCompare(b, undefined, { numeric: true });
		})
		.pop();
}

// Prefer the release tag that points at the commit being built (created by the
// Release Prod / Release Stage / Release Demo workflow on the promoted commit) so the
// app version always matches the corresponding platform release, even when newer tags
// exist (e.g. every develop merge creates one). Falls back to the latest tag for
// builds of untagged commits (e.g. ad-hoc pushes to 'temp').
async function getBuildTag(repoURL) {
	// The check-release-tag gate resolves the release tag of the promoted commit - including
	// merge-commit promotions, where the tag points at the merge parent (the promoted branch
	// tip) rather than at GITHUB_SHA itself - and hands it down via GAUZY_RELEASE_TAG.
	const gateTag = (process.env.GAUZY_RELEASE_TAG || '').trim();
	if (gateTag) {
		if (/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(gateTag)) {
			console.log('Using release tag resolved by the check-release-tag gate:', gateTag);
			return gateTag;
		}
		console.warn(`Ignoring GAUZY_RELEASE_TAG '${gateTag}' - not a vX.Y.Z release tag`);
	}
	try {
		const sha = process.env.GITHUB_SHA || (await git.revparse(['HEAD'])).trim();
		const tagAtCommit = await getTagForCommit(repoURL, sha);
		if (tagAtCommit) {
			console.log(`Using release tag pointing at build commit ${sha}:`, tagAtCommit);
			return tagAtCommit;
		}
		console.log(`No release tag points at build commit ${sha}; falling back to the latest tag`);
	} catch (error) {
		console.error(`Error resolving the tag for the build commit: ${error.message}`);
	}
	return getLatestTag(repoURL);
}

module.exports.serverapi = async (isProd) => {
	if (fs.existsSync('./apps/server-api/src/package.json')) {
		let package = require('../apps/server-api/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.DESKTOP_API_SERVER_APP_NAME;
		console.log('appName', appName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Desktop API Server App with default version', currentVersion);
		}

		package.name = appName;
		package.productName = process.env.DESKTOP_API_SERVER_APP_DESCRIPTION;
		package.description = process.env.DESKTOP_API_SERVER_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.DESKTOP_API_SERVER_APP_ID;
		package.build.productName = process.env.DESKTOP_API_SERVER_APP_DESCRIPTION;
		package.build.linux.executableName = appName;

		const appRepoName = process.env.DESKTOP_API_SERVER_REPO_NAME || appName;
		const appRepoOwner = process.env.DESKTOP_API_SERVER_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/server-api/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/server-api/src/package.json');

		console.log('Version releasing', updated.version);
	}
};

module.exports.server = async (isProd) => {
	if (fs.existsSync('./apps/server/src/package.json')) {
		let package = require('../apps/server/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.DESKTOP_SERVER_APP_NAME;
		console.log('appName', appName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Desktop Server App with default version', currentVersion);
		}

		package.name = appName;
		package.productName = process.env.DESKTOP_SERVER_APP_DESCRIPTION;
		package.description = process.env.DESKTOP_SERVER_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.DESKTOP_SERVER_APP_ID;
		package.build.productName = process.env.DESKTOP_SERVER_APP_DESCRIPTION;
		package.build.linux.executableName = appName;

		const appRepoName = process.env.DESKTOP_SERVER_REPO_NAME || appName;
		const appRepoOwner = process.env.DESKTOP_SERVER_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/server/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/server/src/package.json');

		console.log('Version releasing', updated.version);
	}
};

module.exports.servermcp = async (isProd) => {
	if (fs.existsSync('./apps/server-mcp/src/package.json')) {
		let package = require('../apps/server-mcp/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.DESKTOP_MCP_SERVER_APP_NAME;
		console.log('appName', appName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Desktop MCP Server App with default version', currentVersion);
		}

		package.name = appName;
		package.productName = process.env.DESKTOP_MCP_SERVER_APP_DESCRIPTION;
		package.description = process.env.DESKTOP_MCP_SERVER_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.DESKTOP_MCP_SERVER_APP_ID;
		package.build.productName = process.env.DESKTOP_MCP_SERVER_APP_DESCRIPTION;
		package.build.linux.executableName = appName;

		const appRepoName = process.env.DESKTOP_MCP_SERVER_REPO_NAME || appName;
		const appRepoOwner = process.env.DESKTOP_MCP_SERVER_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/server-mcp/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/server-mcp/src/package.json');

		console.log('Version releasing', updated.version);
	}
};

module.exports.desktop = async (isProd) => {
	if (fs.existsSync('./apps/desktop/src/package.json')) {
		let package = require('../apps/desktop/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.DESKTOP_APP_NAME;
		console.log('appName', appName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Desktop App with default version', currentVersion);
		}

		package.name = appName;
		package.productName = process.env.DESKTOP_APP_DESCRIPTION;
		package.description = process.env.DESKTOP_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.DESKTOP_APP_ID;
		package.build.productName = process.env.DESKTOP_APP_DESCRIPTION;
		package.build.linux.executableName = appName;

		const appRepoName = process.env.DESKTOP_APP_REPO_NAME || appName;
		const appRepoOwner = process.env.DESKTOP_APP_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/desktop/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/desktop/src/package.json');

		console.log('Version releasing', updated.version);
	}
};

module.exports.desktopTimer = async (isProd) => {
	if (fs.existsSync('./apps/desktop-timer/src/package.json')) {
		let package = require('../apps/desktop-timer/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const timerAppName = process.env.DESKTOP_TIMER_APP_NAME;
		console.log('timerAppName', timerAppName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Desktop Timer App with default version', currentVersion);
		}

		package.name = timerAppName;
		package.productName = process.env.DESKTOP_TIMER_APP_DESCRIPTION;
		package.description = process.env.DESKTOP_TIMER_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.DESKTOP_TIMER_APP_ID;
		package.build.productName = process.env.DESKTOP_TIMER_APP_DESCRIPTION;
		package.build.linux.executableName = timerAppName;

		const appRepoName = process.env.DESKTOP_TIMER_APP_REPO_NAME || timerAppName;
		const appRepoOwner = process.env.DESKTOP_TIMER_APP_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/desktop-timer/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/desktop-timer/src/package.json');

		console.log('Version releasing', updated.version);
	}
};

module.exports.agent = async (isProd) => {
	if (fs.existsSync('./apps/agent/src/package.json')) {
		let package = require('../apps/agent/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.AGENT_APP_NAME;
		console.log('appName', appName);

		const stdout = await getBuildTag(repoURL);

		let newVersion = stdout.trim();
		console.log('latest tag', newVersion);

		if (newVersion) {
			// let's remove "v" from version, i.e. first character
			newVersion = newVersion.substring(1);
			package.version = newVersion;

			console.log('Version updated to version', newVersion);
		} else {
			console.log('Latest tag is not found. Build Agent App with default version', currentVersion);
		}

		package.name = appName;
		package.productName = process.env.AGENT_APP_DESCRIPTION;
		package.description = process.env.AGENT_APP_DESCRIPTION;
		package.homepage = process.env.COMPANY_SITE_LINK;

		package.build.appId = process.env.AGENT_APP_ID;
		package.build.productName = process.env.AGENT_APP_DESCRIPTION;
		package.build.linux.executableName = appName;

		const appRepoName = process.env.AGENT_APP_REPO_NAME || appName;
		const appRepoOwner = process.env.AGENT_APP_REPO_OWNER || 'ever-co';

		// For GitHub options see https://www.electron.build/configuration/publish.html

		if (!isProd) {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'prerelease'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				}
			];
		}

		fs.writeFileSync('./apps/agent/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/agent/src/package.json');

		console.log('Version releasing', updated.version);
	}
};
