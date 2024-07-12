import { Component, inject, NgZone, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';

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
	public installing = false;
	public error = '';

	ngOnInit(): void {
		this.pluginElectronService.status
			.pipe(
				tap(({ status, message }) =>
					this.ngZone.run(() => {
						this.installing = false;
						if (status === 'success') {
							this.close();
						} else {
							console.error(message);
							this.error = message;
						}
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public installPlugin(value: string) {
		if (!value) {
			this.error = "the server url musn't be empty";
			return;
		}
		this.installing = true;
		this.pluginElectronService.downloadAndInstall({ url: value.trim() });
	}

	public close() {
		this.dialogRef.close();
	}
}
