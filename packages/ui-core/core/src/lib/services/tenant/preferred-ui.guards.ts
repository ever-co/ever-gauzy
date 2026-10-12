import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { PreferredUiEnum } from '@gauzy/contracts';
import { TenantUiPreferencesService } from './tenant-ui-preferences.service';

/**
 * `canMatch` guard that lets a route take part in matching ONLY when the tenant prefers the
 * given UI flavour.
 *
 * Two plugins can register the very same path (say `/pages/dashboard/time-tracking`) — one with
 * `preferredUiCanMatch(PreferredUiEnum.ANGULAR)`, the other with `PreferredUiEnum.REACT` — and
 * the router falls through to whichever one matches the tenant's choice. Bookmarks, the tab
 * strip and the default-dashboard redirect stay identical across flavours.
 *
 * The guard is async on purpose: the first navigation after sign-in resolves the preference
 * from the API before any flavour renders, so a React tenant never sees the Angular page flash.
 */
export function preferredUiCanMatch(ui: PreferredUiEnum): CanMatchFn {
	return async () => (await inject(TenantUiPreferencesService).ensureLoaded()) === ui;
}
