import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * Whether this server can keep authenticator secrets.
 *
 * They are encrypted with the platform's `EncryptionService` (AES-256-GCM under `ENCRYPTION_KEY`). Without that key
 * the service encrypts with a key of its own process, which the next restart loses: every user who turned two-factor
 * authentication on would then be left with their recovery codes only. So two-factor authentication is offered only
 * on a server whose `ENCRYPTION_KEY` is a base64 32-byte key that was never published in the repository.
 */

/** Why authenticator secrets cannot be kept, or null when they can. */
export type TwoFactorSecretProblem = 'missing' | 'malformed' | 'default';

/** Bytes of an AES-256 key. */
const KEY_BYTES = 32;

/**
 * Why this environment cannot keep authenticator secrets, or null.
 *
 * @param env The environment, `process.env` by default.
 */
export function twoFactorSecretProblem(
	env: Record<string, string | undefined> = process.env
): TwoFactorSecretProblem | null {
	const raw = env['ENCRYPTION_KEY'];
	const isSet = typeof raw === 'string' && raw.trim() !== '';
	if (!isSet) {
		return 'missing';
	}
	if (isKnownDefaultSecret(raw)) {
		return 'default';
	}
	const key = Buffer.from(raw.trim(), 'base64');
	if (key.length !== KEY_BYTES) {
		return 'malformed';
	}
	return null;
}

/**
 * What the API answers when two-factor authentication cannot be turned on, for the operator to act on.
 *
 * @param problem The problem found.
 */
export function twoFactorSecretProblemMessage(problem: TwoFactorSecretProblem): string {
	switch (problem) {
		case 'malformed':
			return 'Two-factor authentication is not available on this server: its ENCRYPTION_KEY is not a base64-encoded 32-byte key.';
		case 'default':
			return 'Two-factor authentication is not available on this server: its ENCRYPTION_KEY is a value published in the Gauzy repository.';
		default:
			return 'Two-factor authentication is not available on this server: set ENCRYPTION_KEY (a base64-encoded 32-byte key) on the API.';
	}
}
