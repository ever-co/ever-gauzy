const { notarize } = require('@electron/notarize');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

/**
 * Validate that a string is valid base64
 */

function isValidBase64(str) {
	if (!str || typeof str !== 'string') return false;

	try {
		// Decode and re-encode - they should match
		const decoded = Buffer.from(str, 'base64');
		const reEncoded = decoded.toString('base64');

		// Compare (ignoring whitespace in original)
		return reEncoded === str.replace(/\s/g, '');
	} catch {
		return false;
	}
}

exports.default = async (context) => {
	const {
		electronPlatformName,
		appOutDir,
		packager: {
			appInfo: { productFilename: appName, id: appBundleId }
		}
	} = context;
	const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = process.env;

	// Skip if not building for macOS
	if (electronPlatformName !== 'darwin') {
		console.log('Skipping notarization: Platform is not darwin.');
		return;
	}

	// Check if credentials are present
	if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
		console.warn(
			'WARN: `APPLE_API_KEY`, `APPLE_API_KEY_ID` & `APPLE_API_ISSUER` are missing. Skipping notarization.'
		);
		return;
	}

	// Validate base64
	if (!isValidBase64(APPLE_API_KEY)) {
		console.error(
			'Invalid APPLE_API_KEY: Not valid base64.'
		);
		return;
	}

	const appPath = path.join(appOutDir, `${appName}.app`);
	const privateKeyPath = path.join(os.tmpdir(), `AuthKey_${APPLE_API_KEY_ID}.p8`);

	try {
		// Write the base64 decoded key to a temporary file
		fs.writeFileSync(privateKeyPath, Buffer.from(APPLE_API_KEY, 'base64'), { mode: 0o600 });

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
		try {
			fs.unlinkSync(privateKeyPath);
		} catch (cleanupError) {
			// Don't throw - just warn
			console.warn(`Warning: Failed to cleanup temporary file: ${cleanupError.message}`);
		}
	}
};
