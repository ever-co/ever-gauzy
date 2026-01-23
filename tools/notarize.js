const { notarize } = require('@electron/notarize');
require('dotenv').config();

exports.default = async (context) => {
	const {
		electronPlatformName,
		appOutDir,
		packager: {
			appInfo: { productFilename: appName, id: appBundleId }
		}
	} = context;

	const { CSC_LINK, APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = process.env;
	const appPath = `${appOutDir}/${appName}.app`;

	if (
		electronPlatformName !== 'darwin' &&
		// If `CSC_LINK` is not defined, the app hasn't been signed before by electron-builder.
		!CSC_LINK
	) {
		return;
	}

	if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
		console.warn('WARN: `APPLE_API_KEY`, `APPLE_API_KEY_ID` & `APPLE_API_ISSUER` are missing');
		return;
	}

	try {
		await notarize({
			tool: 'notarytool',
			appBundleId,
			appPath,
			appleApiKey: APPLE_API_KEY,
			appleApiKeyId: APPLE_API_KEY_ID,
			appleApiIssuer: APPLE_API_ISSUER
		});
	} catch (error) {
		console.error(`ERROR: Failed to notarized: ${error}`);
	}
};
