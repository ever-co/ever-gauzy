/*
 * React Bridge - Renders React components inside Angular with access
 * to Angular services via the Angular injector.
 */

// Context (for use inside React components)
export {
	NgContextProvider,
	NgBridgeContext,
	useBridgeContext,
	type NgReactBridgeContext,
	type NgContextProviderProps
} from './ng-react-context';

// Hooks (for use inside React components)
export { useInjector, usePluginEvents, usePluginEvent, type UsePluginEventsReturn } from './react-hooks';

// Directives (for use in Angular templates)
export { ReactHostDirective, LazyReactHostDirective } from './directives';

// Bridge class and provider
export {
	ReactBridge,
	type ReactBridgeConfig,
	type ReactBridgeMountOptions,
	type ReactBridgeMountResult
} from './react-bridge';
export { REACT_BRIDGE, provideReactBridge, createReactBridge } from './react-bridge.provider';

// React extension helper (for defining React extensions in plugins)
export {
	defineReactExtension,
	isReactExtension,
	type ReactExtensionConfig,
	type ReactExtensionDefinition,
	type ReactExtensionLifecycleContext,
	type ReactExtensionVisibilityContext,
	type ReactExtensionWrapper
} from './react-extension.helper';
