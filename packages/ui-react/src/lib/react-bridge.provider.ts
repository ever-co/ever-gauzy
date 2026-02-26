import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { ReactBridge } from './react-bridge';

/**
 * Injection token for the React bridge instance.
 */
export const REACT_BRIDGE = new InjectionToken<ReactBridge>('ReactBridge');

/**
 * Provide the React bridge for dependency injection.
 *
 * @example
 * ```typescript
 * // In your app.config.ts
 * import { provideReactBridge } from '@gauzy/plugin-ui-react';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideReactBridge(),
 *     // ... other providers
 *   ]
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Using the bridge in a component
 * import { REACT_BRIDGE } from '@gauzy/plugin-ui-react';
 *
 * const bridge = inject(REACT_BRIDGE);
 * bridge.mount({ component: MyReactComponent, hostElement, injector });
 * ```
 *
 * @returns Environment providers for React bridge
 */
export function provideReactBridge(): EnvironmentProviders {
	return makeEnvironmentProviders([
		{
			provide: REACT_BRIDGE,
			useFactory: () => new ReactBridge()
		}
	]);
}

/**
 * Create a ReactBridge instance.
 *
 * @returns A new ReactBridge instance
 */
export function createReactBridge(): ReactBridge {
	return new ReactBridge();
}
