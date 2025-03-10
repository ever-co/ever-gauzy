const { notarize } = require('@electron/notarize');
require('dotenv').config();

exports.default = async (context) => {
	if (process.env.CI) {
		return;
	}
	const {
		electronPlatformName,
		appOutDir,
		packager: {
			appInfo: { productFilename: appName, id: appBundleId }
		}
	} = context;

	const { APPLE_ID, APPLE_ID_APP_PASSWORD, APPLE_TEAM_ID, CSC_LINK } = process.env;
	const appPath = `${appOutDir}/${appName}.app`;

	if (
		electronPlatformName !== 'darwin' &&
		// If `CSC_LINK` is not defined, the app hasn't been signed before by electron-builder.
		!CSC_LINK
	) {
		return;
	}

	if (!APPLE_ID || !APPLE_ID_APP_PASSWORD) {
		throw new Error('`APPLE_ID` or `APPLE_ID_APP_PASSWORD` is missing');
	}

	try {
		await notarize({
			tool: 'notarytool',
			appleId: APPLE_ID,
			appleIdPassword: APPLE_ID_APP_PASSWORD,
			teamId: APPLE_TEAM_ID,
			appBundleId,
			appPath
		});
	} catch (error) {
		console.error(`ERROR: Failed to notarized: ${error}`);
	}
};
