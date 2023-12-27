import { makeInjectableDecorator } from './injectDecoratoryFactory';
import { SENTRY_MODULE_OPTIONS, SENTRY_TOKEN } from './sentry.constants';

export const InjectSentry = makeInjectableDecorator(SENTRY_TOKEN);

/**
 * Injects the Sentry Module config
 */
export const InjectSentryModuleConfig = makeInjectableDecorator(
  SENTRY_MODULE_OPTIONS,
);