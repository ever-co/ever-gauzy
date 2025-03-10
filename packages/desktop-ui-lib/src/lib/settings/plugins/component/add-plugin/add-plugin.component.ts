import { Component, inject, NgZone, OnInit } from '@angular/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { Router } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-plugin',
	templateUrl: './add-plugin.component.html',
	styleUrls: ['./add-plugin.component.scss']
})
export class AddPluginComponent implements OnInit {
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly dialogRef = inject(NbDialogRef<AddPluginComponent>);
	private readonly ngZone = inject(NgZone);
	private readonly router = inject(Router);
	public installing = false;
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

	ngOnInit(): void {
		this.pluginElectronService.status
			.pipe(
				distinctUntilChange(),
				tap(({ status, message }) =>
					this.ngZone.run(() => {
						this.handleStatus({ status, message });
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				this.installing = false;
				this.context = 'local';
				this.close();
				break;
			case 'error':
				this.installing = false;
				this.error = notification.message;
				break;
			case 'inProgress':
				this.installing = true;
				break;
			default:
				this.installing = false;
				break;
		}
	}

	public installPlugin(value: string) {
		if (!value) {
			this.error = "The server URL mustn't be empty.";
			return;
		}
		this.installing = true;
		this.context = 'cdn';
		this.pluginElectronService.downloadAndInstall({ url: value.trim(), contextType: 'cdn' });
	}

	public localPluginInstall() {
		this.installing = true;
		this.context = 'local';
		this.pluginElectronService.downloadAndInstall({ contextType: 'local' });
	}

	public handleUnmaskedValueChange(authToken: string) {
		this.npmModel.registry.authToken = authToken;
	}

	public installPluginFromNPM() {
		this.installing = true;
		this.context = 'npm';
		this.pluginElectronService.downloadAndInstall({ ...this.npmModel, contextType: 'npm' });
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
}
