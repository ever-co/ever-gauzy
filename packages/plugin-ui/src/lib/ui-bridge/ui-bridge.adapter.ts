import { APP_INITIALIZER, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { UiBridge, UiBridgeConfig, UiBridgeMountOptions, UiBridgeMountResult } from './ui-bridge.interface';
import { UiBridgeRegistryService } from './ui-bridge-registry.service';

/**
 * Interface for a bridge-like object that can be adapted to UiBridge.
 * This allows external packages (like @gauzy/ui-react-bridge) to provide
 * bridge implementations without directly depending on @gauzy/plugin-ui.
 */
export interface UiBridgeLike {
	config: {
		frameworkId: string;
		name: string;
		version: string;
	};
	mount(options: {
		component: unknown;
		props?: unknown;
		context?: unknown;
		hostElement: HTMLElement;
		injector: unknown;
	}): {
		unmount: () => void;
		updateProps?: (props: unknown) => void;
	};
	isCompatible(component: unknown): boolean;
}

/**
 * Adapter class that wraps a bridge-like object to conform to UiBridge interface.
 */
class UiBridgeAdapter extends UiBridge {
	readonly config: UiBridgeConfig;

	constructor(private readonly _bridge: UiBridgeLike) {
		super();
		this.config = {
			frameworkId: _bridge.config.frameworkId,
			name: _bridge.config.name,
			version: _bridge.config.version
		};
	}

	mount(options: UiBridgeMountOptions): UiBridgeMountResult {
		return this._bridge.mount(options);
	}

	isCompatible(component: unknown): boolean {
		return this._bridge.isCompatible(component);
	}
}

/**
 * Adapt a bridge-like object to the UiBridge interface.
 *
 * @example
 * ```typescript
 * import { ReactBridge } from '@gauzy/ui-react-bridge';
 * import { adaptBridge, UiBridgeRegistryService } from '@gauzy/plugin-ui';
 *
 * const registry = inject(UiBridgeRegistryService);
 * const reactBridge = adaptBridge(new ReactBridge());
 * registry.register(reactBridge);
 * ```
 */
export function adaptBridge(bridge: UiBridgeLike): UiBridge {
	return new UiBridgeAdapter(bridge);
}

/**
 * Check if an object is a valid bridge-like object.
 */
export function isUiBridgeLike(obj: unknown): obj is UiBridgeLike {
	if (!obj || typeof obj !== 'object') return false;
	const bridge = obj as Record<string, unknown>;
	return (
		typeof bridge['config'] === 'object' &&
		bridge['config'] !== null &&
		typeof (bridge['config'] as Record<string, unknown>)['frameworkId'] === 'string' &&
		typeof bridge['mount'] === 'function' &&
		typeof bridge['isCompatible'] === 'function'
	);
}

/**
 * Provide a bridge-like object to the UI Bridge registry.
 *
 * This is a convenience function that adapts and registers a bridge
 * during application initialization.
 *
 * @example
 * ```typescript
 * import { ReactBridge } from '@gauzy/ui-react-bridge';
 * import { provideBridge } from '@gauzy/plugin-ui';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideBridge(new ReactBridge()),
 *     // or with a factory
 *     provideBridge(() => new ReactBridge())
 *   ]
 * };
 * ```
 */
export function provideBridge(bridgeOrFactory: UiBridgeLike | (() => UiBridgeLike)): EnvironmentProviders {
	return makeEnvironmentProviders([
		{
			provide: APP_INITIALIZER,
			useFactory: (registry: UiBridgeRegistryService) => {
				return () => {
					const bridge = typeof bridgeOrFactory === 'function' ? bridgeOrFactory() : bridgeOrFactory;
					registry.register(adaptBridge(bridge));
				};
			},
			deps: [UiBridgeRegistryService],
			multi: true
		}
	]);
}
