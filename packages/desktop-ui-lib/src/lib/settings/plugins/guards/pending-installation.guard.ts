import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';
import { PendingInstallationActions } from '../component/+state/pending-installation.action';
import { PluginElectronService } from '../services/plugin-electron.service';

/**
 * Guard that checks for non-installed subscribed plugins.
 * This guard performs the check and updates the store state.
 * Navigation is always allowed.
 *
 * Note: This guard does NOT open a dialog because the dialog component
 * is part of the lazy-loaded PluginsModule. The dialog should be
 * opened by a component or service that's loaded after the PluginsModule.
 *
 * To show the pending installation dialog, use the PendingInstallationService
 * or dispatch PendingInstallationActions.openDialog() after the PluginsModule is loaded.
 *
 */
@Injectable({ providedIn: 'root' })
export class PendingInstallationGuard implements CanActivate {
	private readonly actions = inject(Actions);
	private readonly pluginElectronService = inject(PluginElectronService);

	canActivate(
		_route: ActivatedRouteSnapshot,
		_state: RouterStateSnapshot
	): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
		// Skip check if not running in desktop environment
		if (this.pluginElectronService.isDesktop) {
			this.actions.dispatch(PendingInstallationActions.checkAndShowDialog());
		}
		// Perform the check
		return true;
	}
}
