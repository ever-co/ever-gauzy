import { inject, Injectable } from '@angular/core';
import type { IPluginFeatureChecker } from '../plugin-ui.helper';
import { PLUGIN_APP_STORE } from '../plugin-ui.helper';

/**
 * Adapter that bridges the host application's store to the
 * `IPluginFeatureChecker` interface expected by `PluginUiModule`.
 *
 * Uses the `PLUGIN_APP_STORE` token so that `@gauzy/plugin-ui` does not
 * depend on `@gauzy/ui-core/core` directly. The host app provides:
 * ```typescript
 * { provide: PLUGIN_APP_STORE, useExisting: Store }
 * ```
 *
 * Provided via `PluginUiModule.init({ featureChecker: FeatureAdapterService })`.
 * Used by `PageExtensionRegistryService` to check extension-level feature flags.
 */
@Injectable({ providedIn: 'root' })
export class FeatureAdapterService implements IPluginFeatureChecker {
	private readonly _store = inject(PLUGIN_APP_STORE);

	/** Returns true if the specified feature is enabled. */
	isFeatureEnabled(featureKey: string): boolean {
		return this._store.hasFeatureEnabled(featureKey);
	}
}
