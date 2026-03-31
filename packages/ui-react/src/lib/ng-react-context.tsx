import React, { createContext, useContext } from 'react';
import type { Injector } from '@angular/core';
import { PluginErrorBoundary, type PluginErrorInfo } from './plugin-error-boundary';

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
	/** Plugin ID for scoped error reporting. */
	pluginId?: string;
	/** Custom fallback UI for error boundary. */
	errorFallback?: React.ReactNode | ((info: PluginErrorInfo, retry: () => void) => React.ReactNode);
	/** Called when a React error is caught. */
	onError?: (info: PluginErrorInfo) => void;
}

/**
 * React Context provider that exposes Angular's Injector to child React components.
 * Used internally by ReactHostDirective and LazyReactHostDirective.
 *
 * Wraps children in a `PluginErrorBoundary` so that a crash in one React
 * component tree does not propagate to the Angular host or to other plugins.
 */
export function NgContextProvider({
	injector,
	context = {},
	children,
	pluginId,
	errorFallback,
	onError
}: NgContextProviderProps) {
	const value: NgReactBridgeContext = { injector, ...context };
	return React.createElement(
		NgBridgeContext.Provider,
		{ value },
		React.createElement(
			PluginErrorBoundary,
			{ pluginId, fallback: errorFallback, onError },
			children
		)
	);
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
