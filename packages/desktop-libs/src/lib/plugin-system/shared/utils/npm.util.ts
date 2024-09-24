export function formatNpmVersion(version: any): string {
	// Remove special characters like ^, ~, etc.
	const cleanedVersion = String(version).replace(/[^\d.]/g, '');
	// Split the version into components
	const versionParts = cleanedVersion.split('.').map((part) => String(Number(part))); // Remove leading zeros
	// Ensure we have three parts (MAJOR, MINOR, PATCH)
	while (versionParts.length < 3) {
		versionParts.push('0'); // Add missing parts as '0'
	}
	// Join the parts to form the normalized version
	const normalizedVersion = versionParts.slice(0, 3).join('.');

	return normalizedVersion;
}
