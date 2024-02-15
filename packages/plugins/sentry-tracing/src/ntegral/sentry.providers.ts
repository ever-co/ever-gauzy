import { Provider } from '@nestjs/common';
import { SentryModuleOptions } from './sentry.interfaces';
import { SENTRY_TOKEN } from './sentry.constants';
import { SentryService } from './sentry.service';

/**
 * Creates a provider for SentryService using the provided options.
 * @param {SentryModuleOptions} options - Options for configuring the Sentry module.
 * @returns {Provider} A provider for SentryService.
 */
export function createSentryProviders(options: SentryModuleOptions): Provider {
    return {
        provide: SENTRY_TOKEN,
        useValue: new SentryService(options),
    };
}
