import { ChangeDetectionStrategy, Component, inject, Input, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable } from 'rxjs';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { PluginElectronService } from '../../../services/plugin-electron.service';
import { IPlugin } from '../../../services/plugin-loader.service';

@UntilDestroy()
@Component({
	selector: 'lib-plugin-marketplace-detail',
	templateUrl: './plugin-marketplace-detail.component.html',
	styleUrls: ['./plugin-marketplace-detail.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceDetailComponent implements OnInit {
	@Input() plugin!: IPlugin;
	public readonly _isChecked$ = new BehaviorSubject<boolean>(false);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly dialog = inject(NbDialogService);

	ngOnInit(): void {
		if (this.plugin) {
			this._isChecked$.next(this.plugin.installed);
		}
	}

	public togglePlugin(checked: boolean): void {
		this._isChecked$.next(checked);
		checked ? this.installPlugin() : this.uninstallPlugin();
	}

	private installPlugin(): void {
		// TODO
	}

	public get isChecked$(): Observable<boolean> {
		return this._isChecked$.asObservable();
	}

	private uninstallPlugin(): void {
		this.dialog
			.open(AlertComponent, {
				backdropClass: 'backdrop-blur',
				context: {
					data: {
						title: 'Uninstall',
						message: 'Would you like to uninstall this plugin?',
						status: 'basic'
					}
				}
			})
			.onClose.subscribe((isUninstall: boolean) => {
				if (isUninstall) {
					this.pluginElectronService.uninstall(this.plugin);
					this._isChecked$.next(false);
				} else {
					this._isChecked$.next(true);
				}
			});
	}
}
