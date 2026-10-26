import { DynamicModule, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { environment } from '@gauzy/config';
import { OIDC_MODULE_OPTIONS, OidcModuleOptions } from './oidc-module.options';
import { OidcClientService } from './oidc-client.service';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcHttpService } from './oidc-http.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcLogoutTokenService } from './oidc-logout-token.service';
import { OidcTransactionService } from './oidc-transaction.service';

const SERVICES = [
	OidcHttpService,
	OidcDiscoveryService,
	OidcJwksService,
	OidcTransactionService,
	OidcClientService,
	OidcLogoutTokenService
];

/** Default options: the transaction key is derived from the platform's JWT secret. */
const defaultOptionsProvider: Provider = {
	provide: OIDC_MODULE_OPTIONS,
	useFactory: (): OidcModuleOptions => ({ transactionSecret: environment.JWT_SECRET })
};

/**
 * The shared OpenID Connect client library.
 *
 * It is registered nowhere by itself: no strategy, no controller and no route. A provider plugin
 * imports it and decides which issuer to talk to; without such a plugin the library does nothing
 * and makes no outbound request.
 */
@Module({
	imports: [HttpModule],
	providers: [defaultOptionsProvider, ...SERVICES],
	exports: [...SERVICES]
})
export class OidcModule {
	/**
	 * Imports the library with explicit options (tests, or a host without the platform secret).
	 *
	 * @param options - Library options.
	 * @returns The configured module.
	 */
	static forRoot(options: OidcModuleOptions): DynamicModule {
		return {
			module: OidcModule,
			imports: [HttpModule],
			providers: [{ provide: OIDC_MODULE_OPTIONS, useValue: options }, ...SERVICES],
			exports: [...SERVICES]
		};
	}
}
