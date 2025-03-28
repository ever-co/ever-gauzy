import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ID, IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	catchError,
	concatMap,
	EMPTY,
	filter,
	finalize,
	Observable,
	Subject,
	switchMap,
	take,
	tap
} from 'rxjs';
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
	public pluginId: string;
	public selectedVersionId: ID;
	public versions$ = new BehaviorSubject<IPluginVersion[]>([]);
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public isRemoving$ = new BehaviorSubject<boolean>(false);
	public isRecovering$ = new BehaviorSubject<boolean>(false);
	public isEditing$ = new BehaviorSubject<boolean>(false);
	public reload$ = new Subject<void>();

	constructor(
		private readonly toastrService: ToastrNotificationService,
		private readonly pluginService: PluginService,
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this.reload$
			.pipe(
				concatMap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();

		this.route.params
			.pipe(
				switchMap((params) => {
					this.isLoading$.next(true);
					this.pluginId = params['id'];
					if (!this.pluginId) {
						this.isLoading$.next(false);
						return EMPTY;
					}
					return this.load().pipe(finalize(() => this.isLoading$.next(false)));
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): Observable<IPluginVersion[]> {
		return this.pluginService
			.getVersions(this.pluginId, {
				relations: ['plugin', 'source'],
				order: { createdAt: 'DESC' }
			})
			.pipe(
				tap((versions) => this.versions$.next(versions)),
				catchError((error) => {
					this.toastrService.error(`Error fetching plugin versions: ${error.message}`);
					return EMPTY;
				}),
				untilDestroyed(this)
			);
	}

	public async navigateBack(): Promise<void> {
		await this.router.navigate(['settings', 'marketplace-plugins', this.pluginId]);
	}

	public edit(version: IPluginVersion): void {
		if (!version || !this.pluginId || !this.isOwner) return;

		this.selectedVersionId = version.id;

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { version }
			})
			.onClose.pipe(
				filter(Boolean),
				tap(() => this.isEditing$.next(true)),
				switchMap((version: IPluginVersion) =>
					this.pluginService.updateVersion(this.pluginId, version.id, version).pipe(
						tap(() => {
							this.toastrService.success('Update version successfully!');
							this.reload$.next();
						}),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				),
				finalize(() => this.isEditing$.next(false)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public remove(version: IPluginVersion): void {
		if (!version || !this.isOwner) return;

		this.selectedVersionId = version.id;

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
				tap(() => this.isRemoving$.next(true)),
				switchMap(() =>
					this.pluginService.deleteVersion(this.pluginId, version.id).pipe(
						tap(() => {
							this.toastrService.success(`Plugin version ${version.number} removed successfully!`);
							this.reload$.next();
						}),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				),
				finalize(() => {
					this.isRemoving$.next(false);
				})
			)
			.subscribe();
	}

	public restore(version: IPluginVersion): void {
		if (!version || !this.isOwner) return;

		this.selectedVersionId = version.id;

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
				tap(() => this.isRecovering$.next(true)),
				switchMap(() =>
					this.pluginService.restoreVersion(this.pluginId, version.id).pipe(
						tap(() => {
							this.toastrService.success('Plugin version restored successfully!');
							this.reload$.next();
						}),
						catchError((error) => {
							this.toastrService.error(error);
							return EMPTY;
						})
					)
				),
				finalize(() => {
					this.isRecovering$.next(false);
				})
			)
			.subscribe();
	}

	public isOwner(version: IPluginVersion): boolean {
		return !!this.store.user && this.store.user.employee?.id === version?.plugin?.uploadedById;
	}
}
