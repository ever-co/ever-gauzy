import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ZitadelConfigService } from '../services/zitadel-config.service';

/**
 * Every route except `GET /config` answers 404 while the plugin is loaded but has no usable issuer
 * and client, so an unconfigured install exposes nothing and makes no outbound request.
 */
@Injectable()
export class ZitadelConfiguredGuard implements CanActivate {
	constructor(private readonly config: ZitadelConfigService) {}

	async canActivate(): Promise<boolean> {
		if (!(await this.config.isConfigured())) {
			throw new NotFoundException();
		}
		return true;
	}
}
