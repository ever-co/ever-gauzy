/*
 * Public API Surface of @gauzy/ui-react-bridge
 */

// Core context and hooks (for use inside React components)
export { NgContextProvider, NgReactBridgeContext, useBridgeContext } from './lib/ng-react-context';
export {
	useInjector,
	usePluginEvents,
	usePluginEvent,
	usePluginHost,
	usePluginState,
	type PluginEvent,
	type EmitOptions,
	type SubscribeOptions,
	type UsePluginEventsReturn
} from './lib/react-hooks';

// Directives (for use in Angular templates)
export { LazyReactHostDirective, ReactHostDirective } from './lib/directives';

// React Bridge (standalone bridge implementation)
export {
	ReactBridge,
	ReactBridgeConfig,
	ReactBridgeMountOptions,
	ReactBridgeMountResult
} from './lib/react-bridge';
export { REACT_BRIDGE, provideReactBridge, createReactBridge } from './lib/react-bridge.provider';

// React extension helper (for defining React extensions in plugins)
export {
	defineReactExtension,
	isReactExtension,
	type ReactExtensionConfig,
	type ReactExtensionDefinition,
	type ReactExtensionLifecycleContext,
	type ReactExtensionVisibilityContext,
	type ReactExtensionWrapper
} from './lib/react-extension.helper';
