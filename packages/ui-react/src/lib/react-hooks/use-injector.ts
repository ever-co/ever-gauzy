import type { Injector, ProviderToken } from '@angular/core';
import { useContext } from 'react';
import { NgBridgeContext } from '../ng-react-context';

/**
 * React hook to access Angular services from within a React component.
 * Must be used inside a component rendered under NgContextProvider.
 *
 * With token: returns the injected service.
 * Without token: returns the Injector for multiple lookups.
 *
 * @example
 * ```tsx
 * const router = useInjector(Router);
 * router.navigate(['/home']);
 * ```
 *
 * @example
 * ```tsx
 * const injector = useInjector();
 * const http = injector.get(HttpClient);
 * ```
 */
export function useInjector(): Injector;
export function useInjector<T>(token: ProviderToken<T>): T;
export function useInjector<T>(token?: ProviderToken<T>): Injector | T {
	const ctx = useContext(NgBridgeContext);
	if (!ctx) {
		throw new Error('useInjector must be used within NgContextProvider');
	}
	if (token != null) {
		return ctx.injector.get(token) as T;
	}
	return ctx.injector;
}
