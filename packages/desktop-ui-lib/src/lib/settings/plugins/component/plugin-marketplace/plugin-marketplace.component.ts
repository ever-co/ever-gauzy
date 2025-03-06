import { Component, inject, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, from, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { IPlugin } from '../../services/plugin-loader.service';
import { PluginService } from '../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from './plugin-marketplace-upload/plugin-marketplace-upload.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrl: './plugin-marketplace.component.scss'
})
export class PluginMarketplaceComponent implements OnInit {
	public plugins$ = new BehaviorSubject<IPlugin[]>([]);
	private readonly pluginElectronService = inject(PluginElectronService);
	private readonly pluginService = inject(PluginService);
	private readonly toastrNotificationService = inject(ToastrNotificationService);
	private readonly dialog = inject(NbDialogService);
	private readonly ngZone = inject(NgZone);
	private readonly route = inject(ActivatedRoute);
	public processing = false;

	ngOnInit(): void {
		this.observePlugins();
		this.load();
	}

	private observePlugins(): void {
		this.pluginElectronService.status
			.pipe(
				tap((response) => this.ngZone.run(() => this.handleStatus(response))),
				filter((response) => response.status === 'success'),
				switchMap(() => from(this.pluginElectronService.plugins)),
				tap((plugins) => this.ngZone.run(() => this.plugins$.next(plugins))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private handleStatus(notification: { status: string; message?: string }) {
		switch (notification.status) {
			case 'success':
				this.processing = false;
				this.toastrNotificationService.success(notification.message);
				break;
			case 'error':
				this.processing = false;
				this.toastrNotificationService.error(notification.message);
				break;
			case 'inProgress':
				this.processing = true;
				this.toastrNotificationService.info(notification.message);
				break;
			default:
				this.processing = false;
				this.toastrNotificationService.warn('Unexpected Status');
				break;
		}
	}

	public load(): void {
		from(this.pluginElectronService.plugins)
			.pipe(
				tap((plugins: IPlugin[]) =>
					this.ngZone.run(() => {
						const installed = plugins.map((plugin) => ({ ...plugin, installed: true }));
						this.plugins$.next(installed);
					})
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get isUploadAvailable(): boolean {
		return !!this.route.snapshot.data['isUploadAvailable'];
	}

	public upload(): void {
		this.dialog
			.open(PluginMarketplaceUploadComponent, {
				backdropClass: 'backdrop-blur',
				closeOnEsc: false
			})
			.onClose.pipe(
				filter(Boolean),
				switchMap((plugin) =>
					this.pluginService.upload(plugin).pipe(
						tap(() => this.toastrNotificationService.success('Plugin uploaded successfully!')),
						catchError(() => {
							this.toastrNotificationService.error('Plugin upload failed!');
							return EMPTY;
						})
					)
				),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
