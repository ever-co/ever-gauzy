import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ID, IPluginVersion } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, take, tap } from 'rxjs';
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
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent implements OnInit {
	constructor(
		private readonly dialogService: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		private readonly action: Actions,
		public readonly query: PluginVersionQuery
	) {}

	ngOnInit(): void {
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
		this.action.dispatch(
			PluginVersionActions.getAll(this.pluginId, {
				relations: ['plugin', 'source'],
				order: { releaseDate: 'DESC' }
			})
		);
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
						message: `Would you like to delete version ${version.number}?`,
						title: 'Delete plugin version',
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
						message: `Would you like to restore version ${version.number}?`,
						title: 'Restore plugin version',
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
}
