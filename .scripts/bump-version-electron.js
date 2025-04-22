const fs = require('fs');
const simpleGit = require('simple-git');
const git = simpleGit();

async function getLatestTag(repoURL) {
	try {
		// Fetch remote tags
		const tags = await git.listRemote(['--tags', repoURL]);

		// Parse and filter tags
		const tagPattern = /^v?[0-9]+\.[0-9]+\.[0-9]+$/;
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

module.exports.serverapi = async (isProd) => {
	if (fs.existsSync('./apps/server-api/src/package.json')) {
		let package = require('../apps/server-api/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const appName = process.env.DESKTOP_API_SERVER_APP_NAME;
		console.log('appName', appName);

		const stdout = await getLatestTag(repoURL);

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
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}-pre`,
					acl: 'public-read'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}`,
					acl: 'public-read'
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

		const stdout = await getLatestTag(repoURL);

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
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}-pre`,
					acl: 'public-read'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}`,
					acl: 'public-read'
				}
			];
		}

		fs.writeFileSync('./apps/server/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/server/src/package.json');

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

		const stdout = await getLatestTag(repoURL);

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
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}-pre`,
					acl: 'public-read'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}`,
					acl: 'public-read'
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

		const stdout = await getLatestTag(repoURL);

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
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${timerAppName}-pre`,
					acl: 'public-read'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${timerAppName}`,
					acl: 'public-read'
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

		const stdout = await getLatestTag(repoURL);

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
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}-pre`,
					acl: 'public-read'
				}
			];
		} else {
			package.build.publish = [
				{
					provider: 'github',
					repo: appRepoName,
					owner: appRepoOwner,
					releaseType: 'release'
				},
				{
					provider: 'spaces',
					name: 'ever',
					region: 'sfo3',
					path: `/${appName}`,
					acl: 'public-read'
				}
			];
		}

		fs.writeFileSync('./apps/agent/src/package.json', JSON.stringify(package, null, 2));

		let updated = require('../apps/agent/src/package.json');

		console.log('Version releasing', updated.version);
	}
};
