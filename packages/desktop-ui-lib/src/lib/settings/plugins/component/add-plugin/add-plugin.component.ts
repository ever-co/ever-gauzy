import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { PluginInstallationActions } from '../plugin-marketplace/+state/actions/plugin-installation.action';
import { PluginInstallationQuery } from '../plugin-marketplace/+state/queries/plugin-installation.query';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-add-plugin',
    templateUrl: './add-plugin.component.html',
    styleUrls: ['./add-plugin.component.scss'],
    standalone: false
})
export class AddPluginComponent {
	private readonly dialogRef = inject(NbDialogRef<AddPluginComponent>);
	private readonly router = inject(Router);
	private readonly action = inject(Actions);
	private readonly query = inject(PluginInstallationQuery);
	public error = null;
	public context = 'local';
	public showRegistry = false;
	public npmModel = {
		pkg: {
			name: null,
			version: null
		},
		registry: {
			privateURL: null,
			authToken: null
		}
	};

	public installPlugin(value: string) {
		if (!value) {
			this.error = 'TIMER_TRACKER.SETTINGS.PLUGIN_INSTALL_CDN_ERROR';
			return;
		}
		this.context = 'cdn';
		this.action.dispatch(PluginInstallationActions.install({ url: value.trim(), contextType: 'cdn' }));
	}

	public localPluginInstall() {
		this.context = 'local';
		this.action.dispatch(PluginInstallationActions.install({ contextType: 'local' }));
	}

	public handleUnmaskedValueChange(authToken: string) {
		this.npmModel.registry.authToken = authToken;
	}

	public installPluginFromNPM() {
		this.context = 'npm';
		this.action.dispatch(PluginInstallationActions.install({ ...this.npmModel, contextType: 'npm' }));
	}

	public close() {
		this.dialogRef.close();
	}

	public reset() {
		this.context = 'local';
		this.error = null;
	}

	public toggleRegistry(enabled: boolean) {
		this.showRegistry = enabled;
	}

	public async redirectToStore(): Promise<void> {
		await this.router.navigate(['settings', 'marketplace-plugins']);
		this.close();
	}

	public get installing$(): Observable<boolean> {
		return this.query.installing$;
	}
}
