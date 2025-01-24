/**
 * Extract filename from URL
 * @url: string
 * @fallback: string
 * @returns: string
 */
export function extractFilenameFromUrl(url: string, fallback = 'filename'): string {
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.pathname.split('/').pop() || fallback;
	} catch {
		return fallback;
	}
}
