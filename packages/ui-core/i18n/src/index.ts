/*
 * Public API Surface of @gauzy/ui-core/i18n
 */
// Modules
export * from './lib/i18n.module';

// Services
export * from './lib/i18n.service';

// Standalone Providers (Angular 17+)
export * from './lib/i18n.providers';

// HTTP Loader
export * from './lib/translate-http-loader';

// Custom Translate
export * from './lib/custom-compiler';
export * from './lib/custom-handler';
export * from './lib/custom-parser';
export * from './lib/custom-translate-loader';

// Base Components
export * from './lib/translation-base.component';

// Utils
export { getBrowserLanguage } from './lib/utils/get-browser-language';
