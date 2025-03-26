import { Component, inject, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
import { PluginElectronService } from '../../services/plugin-electron.service';
import { PluginService } from '../../services/plugin.service';
import { PluginMarketplaceUploadComponent } from './plugin-marketplace-upload/plugin-marketplace-upload.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrls: ['./plugin-marketplace.component.scss']
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
				tap(() => this.ngZone.run(() => this.load())),
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
		this.pluginService
			.getAll({
				relations: ['versions'],
				order: { createdAt: 'DESC', versions: { createdAt: 'DESC' } }
			})
			.pipe(
				tap((marketPlace) => this.plugins$.next(marketPlace)),
				catchError((error) => {
					this.toastrNotificationService.error(error);
					return EMPTY;
				}),
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
