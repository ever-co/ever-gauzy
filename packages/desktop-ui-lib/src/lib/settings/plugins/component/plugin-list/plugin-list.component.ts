import { ChangeDetectionStrategy, Component, inject, NgZone, OnInit } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, from, Observable, of, switchMap, tap } from 'rxjs';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { AddPluginComponent } from '../add-plugin/add-plugin.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-plugin-list',
	templateUrl: './plugin-list.component.html',
	styleUrls: ['./plugin-list.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginListComponent implements OnInit {
	private readonly translateService = inject(TranslateService);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly dialog = inject(NbDialogService);
	private readonly ngZone = inject(NgZone);
	public plugins$!: Observable<IPlugin[]>;
	public plugin!: IPlugin;
	public readonly smartTableSettings = {
		columns: {
			name: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.PLUGINS.NAME')
			},
			status: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.PLUGINS.STATUS')
			},
			version: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.PLUGINS.VERSION')
			},
			update: {
				title: this.translateService.instant('TIMER_TRACKER.SETTINGS.PLUGINS.UPDATE')
			}
		},
		hideSubHeader: true,
		actions: false,
		noDataMessage: this.translateService.instant('SM_TABLE.NO_DATA.PLUGIN'),
		pager: {
			display: true,
			perPage: 10,
			page: 1
		}
	};

	ngOnInit(): void {
		this.pluginElectronService.status
			.pipe(
				tap((response) => console.log(response)),
				filter((response) => response.status === 'success'),
				switchMap(() => from(this.pluginElectronService.plugins)),
				untilDestroyed(this)
			)
			.subscribe((plugins) => {
				this.ngZone.run(() => {
					this.plugins$ = of(plugins);
				});
			});
		this.pluginElectronService.load();
	}

	public handleRowSelection(event) {
		this.plugin = event.selected[0];
	}

	public changeStatus() {
		this.pluginElectronService.activate(this.plugin);
	}

	public addPlugin() {
		this.dialog
			.open(AddPluginComponent, {
				backdropClass: 'backdrop-blur'
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe();
	}
}
