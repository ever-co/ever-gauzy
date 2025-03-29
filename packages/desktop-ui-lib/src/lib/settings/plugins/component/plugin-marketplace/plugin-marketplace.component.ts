import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, finalize, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../services';
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
	private readonly pluginService = inject(PluginService);
	private readonly toastrNotificationService = inject(ToastrNotificationService);
	private readonly dialog = inject(NbDialogService);
	private readonly route = inject(ActivatedRoute);
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public isUploading$ = new BehaviorSubject<boolean>(false);

	ngOnInit(): void {
		this.isLoading$.next(true);
		this.load();
	}

	public load(): void {
		this.pluginService
			.getAll({
				relations: ['versions'],
				order: { createdAt: 'DESC', versions: { createdAt: 'DESC' } }
			})
			.pipe(
				finalize(() => this.isLoading$.next(false)),
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
				tap(() => this.isUploading$.next(true)),
				switchMap((plugin) =>
					this.pluginService.upload(plugin).pipe(
						tap(() => this.toastrNotificationService.success('Plugin uploaded successfully!')),
						finalize(() => this.isUploading$.next(false)),
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
