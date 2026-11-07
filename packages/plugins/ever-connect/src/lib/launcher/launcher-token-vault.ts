import { Inject, Injectable, Optional } from '@nestjs/common';
import { EverIdTokenVaultPort } from '@gauzy/plugin-auth-zitadel';
import { EVER_CONNECT_ENV } from '../ever-connect.constants';
import { EverConnectSecretStore } from '../ever-connect-secret-store';

/**
 * The encryption of the Ever ID refresh token each Ever ID session keeps for the App Launcher, which this module
 * provides to the Ever ID sign-in plugin (`EVER_ID_TOKEN_VAULT`) while the launcher is on: the same AES-256-GCM as the
 * installation's keys and this module's documents ({@link EverConnectSecretStore}, under `ENCRYPTION_KEY` or a
 * non-default `JWT_SECRET`), with a purpose of its own (`ever_id_refresh_token`) bound into the ciphertext, so a
 * token cannot be read as anything else, nor anything else as a token. Without such a secret it is not `usable` and
 * the sign-in plugin keeps nothing.
 */
@Injectable()
export class LauncherTokenVault implements EverIdTokenVaultPort {
	private readonly secrets: EverConnectSecretStore;

	constructor(@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>) {
		this.secrets = new EverConnectSecretStore(env ?? process.env);
	}

	usable(): boolean {
		return this.secrets.usable();
	}

	seal(value: string): string {
		return this.secrets.seal(value, 'ever_id_refresh_token');
	}

	open(blob: string | null | undefined): string | null {
		return this.secrets.open(blob, 'ever_id_refresh_token');
	}
}
