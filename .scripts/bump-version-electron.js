const fs = require('fs');
const { exec } = require('child_process');

// TODO: combine all 3 functions below to one with parameter :)

module.exports.server = (isProd) => {
	if (fs.existsSync('./apps/server/src/package.json')) {
		let package = require('../apps/server/src/package.json');
		let currentVersion = package.version;

		exec(
			'git fetch --tags && git tag --sort version:refname | tail -1',
			(error, stdout) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return;
				}

				let newVersion = stdout.trim();
				console.log('latest tag', newVersion);
				if (newVersion) {
					// let's remove "v" from version, i.e. first character
					newVersion = newVersion.substring(1);
					package.version = newVersion;

					if (!isProd) {
						package.build.publish = [
							{
								provider: 'github',
								repo: 'ever-gauzy-server',
								releaseType: 'prerelease',
							},
							{
								provider: 'spaces',
								name: 'ever',
								region: 'sfo3',
								path: '/ever-gauzy-server-pre',
								acl: 'public-read',
							},
						];
					}

					fs.writeFileSync(
						'./apps/server/src/package.json',
						JSON.stringify(package, null, 2)
					);

					let updated = require('../apps/server/src/package.json');
					console.log(
						'Version updated to version => ',
						updated.version
					);
				} else {
					console.log(
						'Latest tag is not found. build server with default version',
						currentVersion
					);
				}
			}
		);
	}
};

module.exports.desktop = (isProd) => {
	if (fs.existsSync('./apps/desktop/src/package.json')) {
		let package = require('../apps/desktop/src/package.json');
		let currentVersion = package.version;

		exec(
			'git fetch --tags && git tag --sort version:refname | tail -1',
			(error, stdout) => {
				if (error) {
					console.error(`exec error: ${error}`);
					return;
				}

				let newVersion = stdout.trim();
				console.log('latest tag', newVersion);
				if (newVersion) {
					// let's remove "v" from version, i.e. first character
					newVersion = newVersion.substring(1);
					package.version = newVersion;

					if (!isProd) {
						package.build.publish = [
							{
								provider: 'github',
								repo: 'ever-gauzy-desktop',
								releaseType: 'prerelease',
							},
							{
								provider: 'spaces',
								name: 'ever',
								region: 'sfo3',
								path: '/ever-gauzy-desktop-pre',
								acl: 'public-read',
							},
						];
					}

					fs.writeFileSync(
						'./apps/desktop/src/package.json',
						JSON.stringify(package, null, 2)
					);

					let updated = require('../apps/desktop/src/package.json');
					console.log(
						'Version updated to version => ',
						updated.version
					);
				} else {
					console.log(
						'Latest tag is not found. build desktop app with default version',
						currentVersion
					);
				}
			}
		);
	}
};

module.exports.desktopTimer = (isProd) => {
	if (fs.existsSync('./apps/desktop-timer/src/package.json')) {
		let package = require('../apps/desktop-timer/src/package.json');
		let currentVersion = package.version;

		const repoURL = process.env.PROJECT_REPO;
		console.log('repoURL', repoURL);

		const timerAppName = process.env.DESKTOP_TIMER_APP_NAME;
		console.log('timerAppName', timerAppName);

		const command =
			'git ls-remote --tags ' +
			repoURL +
			" | grep -v '\\^{}' | awk -F'/' '/refs/tags\\// {print $3}' | grep -E '^v?[0-9]+\\.[0-9]+\\.[0-9]+' | sort -V | tail -n1";

		console.log('command', command);

		exec(command, (error, stdout) => {
			if (error) {
				console.error(`exec error: ${error}`);
				return;
			}

			let newVersion = stdout.trim();
			console.log('latest tag', newVersion);

			if (newVersion) {
				// let's remove "v" from version, i.e. first character
				newVersion = newVersion.substring(1);
				package.version = newVersion;

				console.log('Version updated to version', newVersion);
			} else {
				console.log(
					'Latest tag is not found. build desktop-timer app with default version',
					currentVersion
				);
			}

			package.name = timerAppName;
			package.productName = process.env.DESKTOP_TIMER_APP_DESCRIPTION;
			package.description = process.env.DESKTOP_TIMER_APP_DESCRIPTION;
			package.homepage = process.env.COMPANY_SITE_LINK;

			package.build.appId = process.env.DESKTOP_TIMER_APP_ID;
			package.build.productName =
				process.env.DESKTOP_TIMER_APP_DESCRIPTION;
			package.build.linux.executableName = timerAppName;

			if (!isProd) {
				package.build.publish = [
					{
						provider: 'github',
						repo: timerAppName,
						releaseType: 'prerelease',
					},
					{
						provider: 'spaces',
						name: 'ever',
						region: 'sfo3',
						path: `/${timerAppName}-pre`,
						acl: 'public-read',
					},
				];
			} else {
				package.build.publish = [
					{
						provider: 'github',
						repo: timerAppName,
						releaseType: 'release',
					},
					{
						provider: 'spaces',
						name: 'ever',
						region: 'sfo3',
						path: `/${timerAppName}`,
						acl: 'public-read',
					},
				];
			}

			fs.writeFileSync(
				'./apps/desktop-timer/src/package.json',
				JSON.stringify(package, null, 2)
			);

			let updated = require('../apps/desktop-timer/src/package.json');

			console.log('Version releasing', updated.version);
		});
	}
};
