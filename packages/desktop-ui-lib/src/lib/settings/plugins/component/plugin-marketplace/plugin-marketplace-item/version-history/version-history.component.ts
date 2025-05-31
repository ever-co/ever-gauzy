import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ID, IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, map, take, tap } from 'rxjs';
import { PluginVersionActions } from '../../+state/actions/plugin-version.action';
import { PluginVersionQuery } from '../../+state/queries/plugin-version.query';
import { AlertComponent } from '../../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../../services';
import { DialogCreateVersionComponent } from '../dialog-create-version/dialog-create-version.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-version-history',
	templateUrl: './version-history.component.html',
	styleUrls: ['./version-history.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent implements OnInit, OnDestroy {
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		private readonly action: Actions,
		public readonly query: PluginVersionQuery
	) {}

	ngOnInit(): void {
		this.query
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();

		this.route.params
			.pipe(
				tap((params) => {
					this.action.dispatch(PluginVersionActions.setCurrentPluginId(params['id']));
					this.load();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): void {
		if (!this.pluginId) {
			return;
		}
		this.action.dispatch(
			PluginVersionActions.getAll(this.pluginId, {
				skip: this.skip,
				take: this.take,
				relations: ['plugin', 'sources'],
				order: { releaseDate: 'DESC' },
				withDeleted: true
			})
		);
	}

	public loadMore(): void {
		if (this.hasNext && this.unlockInfiniteList) {
			this.skip++;
			this.load();
		}
	}

	public async navigateBack(): Promise<void> {
		await this.router.navigate(['settings', 'marketplace-plugins', this.pluginId]);
	}

	public edit(version: IPluginVersion): void {
		if (!version || !this.pluginId || !this.isOwner(version)) return;

		this.action.dispatch(PluginVersionActions.selectVersion(version));

		this.dialogService
			.open(DialogCreateVersionComponent, {
				backdropClass: 'backdrop-blur',
				context: { version }
			})
			.onClose.pipe(
				filter(Boolean),
				tap((version: IPluginVersion) =>
					this.action.dispatch(PluginVersionActions.update(this.pluginId, version.id, version))
				),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public remove(version: IPluginVersion): void {
		if (!version || !this.pluginId || !this.isOwner(version)) return;

		this.action.dispatch(PluginVersionActions.selectVersion(version));

		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: 'PLUGIN.DIALOG.VERSION.DELETE.DESCRIPTION',
						title: 'PLUGIN.DIALOG.VERSION.DELETE.TITLE',
						confirmText: 'PLUGIN.DIALOG.VERSION.DELETE.CONFIRM',
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => this.action.dispatch(PluginVersionActions.delete(this.pluginId, version.id)))
			)
			.subscribe();
	}

	public restore(version: IPluginVersion): void {
		if (!version || !this.isOwner(version)) return;

		this.action.dispatch(PluginVersionActions.selectVersion(version));

		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						message: 'PLUGIN.DIALOG.VERSION.RESTORE.DESCRIPTION',
						title: 'PLUGIN.DIALOG.VERSION.RESTORE.TITLE',
						confirmText: 'PLUGIN.DIALOG.VERSION.RESTORE.CONFIRM',
						status: 'warn'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => this.action.dispatch(PluginVersionActions.restore(this.pluginId, version.id)))
			)
			.subscribe();
	}

	public isOwner(version: IPluginVersion): boolean {
		return !!this.store.user && this.store.user.employee?.id === version?.plugin?.uploadedById;
	}

	public get pluginId(): ID {
		return this.query.pluginId;
	}

	public get unlockInfiniteList(): boolean {
		return this.pluginId && this.query.versions.length > 0;
	}

	ngOnDestroy(): void {
		this.skip = 1;
		this.hasNext = false;
		this.action.dispatch(PluginVersionActions.reset());
	}
}
