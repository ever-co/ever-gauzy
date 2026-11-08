import { CanActivate, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { isEverConnectEnabled } from '../ever-connect-enabled';
import { EVER_CONNECT_ENV } from '../ever-connect.constants';
import { EverConnectStore } from '../ever-connect.store';
import { EverConnectProvisionService } from '../services/ever-connect-provision.service';

/**
 * Every route of creating a workspace from Ever answers 404, as if it did not exist, unless:
 * `EVER_CONNECT_ENABLED=true` (read again here), `EVER_CONNECT_PROVISION_ENABLED=true`, the Ever ID
 * sign-in plugin is loaded (it signs the person in and creates the workspace), and this installation is
 * connected to Ever Platform. The request itself is verified by the routes (fail-closed, 401
 * `intent_invalid` for every check but the product, 422 `product_mismatch`).
 */
@Injectable()
export class EverConnectProvisionGuard implements CanActivate {
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly provisions: EverConnectProvisionService,
		private readonly store: EverConnectStore,
		@Optional() @Inject(EVER_CONNECT_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	async canActivate(): Promise<boolean> {
		if (!isEverConnectEnabled(this.env) || !this.provisions.available) {
			throw new NotFoundException();
		}
		const connection = await this.store.connection().catch(() => null);
		if (connection?.status !== 'connected' || !connection.platformInstanceId) {
			throw new NotFoundException();
		}
		return true;
	}
}
