import React, { createContext, useContext } from 'react';
import type { Injector } from '@angular/core';

/**
 * Bridge context passed from Angular host to React components.
 * Exposes the Angular injector plus any optional extra values.
 */
export interface NgReactBridgeContext {
	injector: Injector;
	[key: string]: unknown;
}

/** @internal Used by useInjector and useBridgeContext */
export const NgBridgeContext = createContext<NgReactBridgeContext | null>(null);

export interface NgContextProviderProps {
	injector: Injector;
	/** Optional extra values merged with injector (e.g. config, feature flags) */
	context?: Record<string, unknown>;
	/** Child components to render within the provider */
	children?: React.ReactNode;
}

/**
 * React Context provider that exposes Angular's Injector to child React components.
 * Used internally by ReactHostDirective and LazyReactHostDirective.
 */
export function NgContextProvider({ injector, context = {}, children }: NgContextProviderProps) {
	const value: NgReactBridgeContext = { injector, ...context };
	return React.createElement(NgBridgeContext.Provider, { value }, children);
}

/**
 * Access the full bridge context (injector + any extra values from the context input).
 */
export function useBridgeContext(): NgReactBridgeContext {
	const ctx = useContext(NgBridgeContext);
	if (!ctx) {
		throw new Error('useBridgeContext must be used within NgContextProvider');
	}
	return ctx;
}
