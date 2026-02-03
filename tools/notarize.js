const { notarize } = require('@electron/notarize');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

/**
 * Check if a string looks like a file path and the file exists
 */
function isFilePath(str) {
	if (!str || typeof str !== 'string') return false;

	// Check if it looks like a path (starts with / or contains path separators)
	const looksLikePath =
		str.startsWith('/') ||
		str.startsWith('./') ||
		str.startsWith('../') ||
		str.includes(path.sep) ||
		str.endsWith('.p8');

	if (!looksLikePath) return false;

	// Check if the file actually exists
	try {
		return fs.existsSync(str);
	} catch {
		return false;
	}
}

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

	// Case 1: APPLE_API_KEY is a file path - electron-builder handles notarization automatically
	if (isFilePath(APPLE_API_KEY)) {
		console.log(
			`Skipping custom notarization: APPLE_API_KEY is a file path (${APPLE_API_KEY}). ` +
				'Electron-builder will handle notarization automatically.'
		);
		return;
	}

	// Case 2: APPLE_API_KEY is base64 encoded - decode and notarize manually
	if (isValidBase64(APPLE_API_KEY)) {
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
		return;
	}

	// Case 3: APPLE_API_KEY is neither a file path nor valid base64
	console.warn(
		'WARN: APPLE_API_KEY is not a valid file path or base64-encoded string. ' +
			'Skipping notarization. Please set APPLE_API_KEY to either:\n' +
			'  - A file path to the .p8 private key (e.g., /path/to/AuthKey_XXXXX.p8)\n' +
			'  - A base64-encoded string of the private key contents'
	);
};
