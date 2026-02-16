import { InjectionToken } from '@angular/core';

/**
 * Optional injection token for the default logger context (prefix).
 * When provided, {@link LoggerService} uses it when no context is passed to log methods.
 *
 * @example
 * ```ts
 * @Component({
 *   providers: [{ provide: LOGGER_CONTEXT, useValue: 'MyComponent' }]
 * })
 * export class MyComponent {
 *   constructor(private readonly logger: LoggerService) {}
 *   // this.logger.log('hello') => "[MyComponent] hello"
 * }
 * ```
 */
export const LOGGER_CONTEXT = new InjectionToken<string>('LOGGER_CONTEXT');
