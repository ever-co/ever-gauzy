import { connectKeyMaterialProblem, EverInstanceKeyError, KeyPurpose, unwrapKey, wrapKey } from '@gauzy/plugin-ever-instance';

type Env = Record<string, string | undefined>;

/** What a stored value is: an entitlement document, or an integration's configuration. */
export type SecretPurpose = Extract<KeyPurpose, 'entitlement' | 'integration_config'>;

/**
 * Stores what the Ever Platform connection keeps on this installation (entitlement documents, the
 * sign-in client of Sign in with Ever ID, the link to an export) with
 * the same AES-256-GCM encryption as the installation's keys (`@gauzy/plugin-ever-instance`): under
 * `ENCRYPTION_KEY`, or a key derived from a non-default `JWT_SECRET`. Never Gauzy's integration
 * setting "wrapping", which only masks a value for display and stores it in clear.
 *
 * A stored value that cannot be decrypted (the secret changed) reads as missing, so the document is
 * fetched again; it is never logged.
 */
export class EverConnectSecretStore {
	constructor(private readonly env: Env = process.env) {}

	/** Whether values can be stored safely with the secrets of this process. */
	usable(): boolean {
		return connectKeyMaterialProblem(this.env) === null;
	}

	seal(value: string, purpose: SecretPurpose = 'entitlement'): string {
		const problem = connectKeyMaterialProblem(this.env);
		if (problem) {
			throw new Error(`An Ever Platform document cannot be stored safely (${problem}).`);
		}
		const plain = Buffer.from(value, 'utf8');
		try {
			return wrapKey(plain, purpose, this.env);
		} finally {
			plain.fill(0);
		}
	}

	/** The stored value, or `null` when there is none or it cannot be read with the secrets of this process. */
	open(blob: string | null | undefined, purpose: SecretPurpose = 'entitlement'): string | null {
		if (!blob) {
			return null;
		}
		try {
			const plain = unwrapKey(blob, purpose, this.env);
			const value = plain.toString('utf8');
			plain.fill(0);
			return value;
		} catch (error) {
			if (error instanceof EverInstanceKeyError) {
				return null;
			}
			throw error;
		}
	}
}
