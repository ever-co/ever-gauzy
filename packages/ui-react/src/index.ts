/*
 * Public API Surface of @gauzy/plugin-ui-react
 *
 * React-to-Angular bridge: renders React components inside Angular with
 * access to Angular services via the Angular injector.
 */

// Context (for use inside React components)
export {
	NgContextProvider,
	NgBridgeContext,
	useBridgeContext,
	type NgReactBridgeContext,
	type NgContextProviderProps
} from './lib/ng-react-context';

// Hooks (for use inside React components)
export {
	useInjector,
	useObservable,
	usePluginState,
	useTranslation,
	usePluginEvents,
	usePluginEvent,
	type UsePluginEventsReturn
} from './lib/react-hooks';

// Directives (for use in Angular templates)
export { ReactHostDirective, LazyReactHostDirective } from './lib/directives';

// Bridge class and provider
export {
	ReactBridge,
	type ReactBridgeConfig,
	type ReactBridgeMountOptions,
	type ReactBridgeMountResult
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
