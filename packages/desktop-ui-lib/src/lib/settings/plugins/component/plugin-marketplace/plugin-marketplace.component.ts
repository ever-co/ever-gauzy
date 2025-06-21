import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, map, tap } from 'rxjs';
import { PluginMarketplaceActions } from './+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from './+state/queries/plugin-marketplace.query';
import { PluginMarketplaceUploadComponent } from './plugin-marketplace-upload/plugin-marketplace-upload.component';
import { Store } from '../../../../services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrls: ['./plugin-marketplace.component.scss'],
	standalone: false
})
export class PluginMarketplaceComponent implements OnInit, OnDestroy {
	private skip = 1;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly dialog: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly action: Actions,
		public readonly query: PluginMarketplaceQuery,
		public readonly store: Store
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
		this.load();
	}

	public load(): void {
		this.action.dispatch(
			PluginMarketplaceActions.getAll({
				skip: this.skip,
				take: this.take,
				relations: ['uploadedBy', 'uploadedBy.user'],
				order: { createdAt: 'DESC' }
			})
		);
	}

	public loadMore(): void {
		if (this.hasNext) {
			this.skip++;
			this.load();
		}
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
				tap((plugin: IPlugin) => this.action.dispatch(PluginMarketplaceActions.upload(plugin))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {
		this.skip = 1;
		this.hasNext = false;
		this.action.dispatch(PluginMarketplaceActions.reset());
	}
}
