// Types and constants
export * from './page-extension-slot.types';

// Services
export {
	PageExtensionRegistryService,
	type ExtensionRegistrationOptions,
	type SlotRegistrationOptions
} from './page-extension-registry.service';

export {
	PluginEventBusService,
	PluginEventEmitter,
	type PluginEvent,
	type EmitOptions,
	type SubscribeOptions
} from './plugin-event-bus.service';

// Components
export { PageExtensionSlotComponent } from './page-extension-slot.component';
