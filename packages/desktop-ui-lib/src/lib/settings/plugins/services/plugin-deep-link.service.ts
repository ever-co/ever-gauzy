import { Injectable, OnDestroy } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Subscription, tap } from 'rxjs';
import { ElectronService } from '../../../electron/services/electron/electron.service';
import { PluginDeepLinkActions } from '../component/plugin-marketplace/+state/actions/plugin-deep-link.action';

export interface IDeepLinkInstallPayload {
	pluginId: string;
	versionId?: string;
	forceInstall?: boolean;
}

/**
 * Service for deep-link driven plugin installation.
 */
@Injectable({ providedIn: 'root' })
export class PluginDeepLinkService implements OnDestroy {
	private readonly subscription: Subscription;

	constructor(
		private readonly electronService: ElectronService,
		private readonly actions: Actions
	) {
		this.subscription = this.electronService
			.fromEvent<IDeepLinkInstallPayload>('deep-link-install-plugin')
			.pipe(tap((payload) => this.actions.dispatch(PluginDeepLinkActions.install(payload))))
			.subscribe();
	}

	ngOnDestroy(): void {
		this.subscription?.unsubscribe();
	}
}
