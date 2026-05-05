import { execFile } from 'node:child_process';
export function isJSON<T>(input: T): boolean {
	try {
		JSON.parse(input as string);
		return true;
	} catch (e) {
		return false;
	}
}

export function runTccutil(service: string, bundleId: string, timeoutMs = 8000): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(
			'tccutil',
			['reset', service, bundleId],
			{ timeout: timeoutMs },
			(err) => {
				if (err) reject(err);
				else resolve();
			}
		);
	});
}

export function getAppId() {
	return process.env.APP_ID || 'com.ever.gauzydesktoptimer';
}
