import { inject, Injectable } from '@angular/core';
import type { IPluginPermissionChecker } from '../plugin-ui.helper';
import { PLUGIN_APP_STORE } from '../plugin-ui.helper';

/**
 * Adapter that bridges the host application's store to the
 * `IPluginPermissionChecker` interface expected by `PluginUiModule`.
 *
 * Uses the `PLUGIN_APP_STORE` token so that `@gauzy/plugin-ui` does not
 * depend on `@gauzy/ui-core/core` directly. The host app provides:
 * ```typescript
 * { provide: PLUGIN_APP_STORE, useExisting: Store }
 * ```
 *
 * Provided via `PluginUiModule.init({ permissionChecker: PermissionAdapterService })`.
 * Used by `PageExtensionRegistryService` to check extension-level permissions.
 */
@Injectable({ providedIn: 'root' })
export class PermissionAdapterService implements IPluginPermissionChecker {
	private readonly _store = inject(PLUGIN_APP_STORE);

	/** Returns true if the user has the specified permission. */
	hasPermission(permission: string): boolean {
		return this._store.hasPermission(permission);
	}

	/** Returns true if the user has ALL specified permissions. */
	hasAllPermissions(...permissions: string[]): boolean {
		return this._store.hasAllPermissions(...permissions);
	}

	/** Returns true if the user has ANY of the specified permissions. */
	hasAnyPermission(...permissions: string[]): boolean {
		return this._store.hasAnyPermission(...permissions);
	}
}
