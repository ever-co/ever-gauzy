import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, catchError, EMPTY, filter, finalize, Observable, switchMap, take, tap } from 'rxjs';
import { AlertComponent } from '../../../../../../dialogs/alert/alert.component';
import { Store, ToastrNotificationService } from '../../../../../../services';
import { PluginService } from '../../../../services/plugin.service';
import { DialogCreateVersionComponent } from '../dialog-create-version/dialog-create-version.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-version-history',
	templateUrl: './version-history.component.html',
	styleUrl: './version-history.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent implements OnInit {
	public versions$!: Observable<IPluginVersion[]>;
	public pluginId: string;
	public isLoading$ = new BehaviorSubject<boolean>(false);

	constructor(
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginService: PluginService,
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this.isLoading$.next(true);
		this.versions$ = this.route.params.pipe(
			switchMap((params) => {
				this.pluginId = params['id'];
				if (!this.pluginId) {
					this.isLoading$.next(false);
					return EMPTY;
				}
				return this.pluginService
					.getVersions(this.pluginId, {
						relations: ['plugin', 'source'],
						order: { createdAt: 'DESC' },
						withDeleted: true
					})
					.pipe(
						finalize(() => this.isLoading$.next(false)),
						catchError((error) => {
							this.toastrService.error('Error fetching plugin versions');
							return EMPTY;
						})
					);
			}),
			untilDestroyed(this)
		);
	}

	public navigateBack(): void {
		this.router.navigate(['settings', 'marketplace-plugins', this.pluginId]);
	}

	public edit(version: IPluginVersion): void {
		if (!version || !this.isOwner) return;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { version }
			})
			.onClose.pipe(
				filter(Boolean),
				switchMap((version: IPluginVersion) =>
					this.pluginService.updateVersion(this.pluginId, version.id, version).pipe(
						tap(() => this.toastrService.success('Update version successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public remove(version: IPluginVersion): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: `Would you like to delete version ${version.number}?`,
						title: 'Delete plugin version',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				switchMap(() =>
					this.pluginService.restoreVersion(this.pluginId, version.id).pipe(
						tap(() => this.toastrService.success(`Plugin version ${version.number} removed successfully!`)),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}

	public restore(version: IPluginVersion): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: `Would you like to restore version ${version.number}?`,
						title: 'Restore plugin version',
						status: 'warn'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				switchMap(() =>
					this.pluginService.deleteVersion(this.pluginId, version.id).pipe(
						tap(() => this.toastrService.success('Plugin version restored successfully!')),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				)
			)
			.subscribe();
	}

	public isOwner(version: IPluginVersion): boolean {
		return !!this.store.user && this.store.user.employee?.id === version?.plugin?.uploadedById;
	}
}
