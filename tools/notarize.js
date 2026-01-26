const { notarize } = require('@electron/notarize');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

exports.default = async (context) => {
	const {
		electronPlatformName,
		appOutDir,
		packager: {
			appInfo: { productFilename: appName, id: appBundleId }
		}
	} = context;

	const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = process.env;

	// Skip if not building for macOS or if the app is not signed
	// In GitHub Actions, CSC_LINK is typically used for the certificate.
	if (electronPlatformName !== 'darwin') {
		console.log('Skipping notarization: Platform is not darwin.');
		return;
	}

	if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
		console.warn(
			'WARN: `APPLE_API_KEY`, `APPLE_API_KEY_ID` & `APPLE_API_ISSUER` are missing. Skipping notarization.'
		);
		return;
	}

	const appPath = path.join(appOutDir, `${appName}.app`);
	const privateKeyPath = path.join(os.tmpdir(), `AuthKey_${APPLE_API_KEY_ID}.p8`);

	try {
		// Write the base64 decoded key to a temporary file
		fs.writeFileSync(privateKeyPath, Buffer.from(APPLE_API_KEY, 'base64'));

		console.log(`Notarizing ${appBundleId} found at ${appPath}...`);

		await notarize({
			tool: 'notarytool',
			appBundleId,
			appPath,
			appleApiKey: privateKeyPath,
			appleApiKeyId: APPLE_API_KEY_ID,
			appleApiIssuer: APPLE_API_ISSUER
		});

		console.log(`Notarization successful for ${appBundleId}.`);
	} catch (error) {
		console.error(`ERROR: Failed to notarize: ${error}`);
	} finally {
		// Clean up the secret key file
		if (fs.existsSync(privateKeyPath)) {
			fs.unlinkSync(privateKeyPath);
		}
	}
};
