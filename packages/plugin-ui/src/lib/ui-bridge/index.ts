/*
 * UI Bridge - Framework-agnostic bridge system for rendering
 * non-Angular components (React, Vue, Svelte, etc.) inside Angular.
 */

// Core interface and types
export {
	UiBridge,
	UiBridgeConfig,
	UiBridgeMountOptions,
	UiBridgeMountResult,
	UiBridgeFramework,
	UI_BRIDGE_FRAMEWORK
} from './ui-bridge.interface';

// Registry service
export {
	UiBridgeRegistryService,
	type BridgeFactory,
	type LazyBridgeRegistration,
	type BridgeRegistrationOptions
} from './ui-bridge-registry.service';

// Host component
export { FrameworkHostComponent } from './framework-host.component';

// Extension helpers
export {
	FrameworkExtensionConfig,
	FrameworkExtensionDefinition,
	defineFrameworkExtension,
	isFrameworkExtension,
	getExtensionFrameworkId
} from './framework-extension.helper';

// Bridge adapter (for integrating external bridges)
export { UiBridgeLike, adaptBridge, isUiBridgeLike, provideBridge } from './ui-bridge.adapter';
