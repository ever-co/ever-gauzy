import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, tap } from 'rxjs';
import { PluginMarketplaceActions } from './+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from './+state/queries/plugin-marketplace.query';
import { PluginMarketplaceUploadComponent } from './plugin-marketplace-upload/plugin-marketplace-upload.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrls: ['./plugin-marketplace.component.scss']
})
export class PluginMarketplaceComponent implements OnInit, OnDestroy {
	private skip = 0;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly dialog: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly action: Actions,
		public readonly query: PluginMarketplaceQuery
	) {}

	ngOnInit(): void {
		this.query.count$
			.pipe(
				distinctUntilChanged(),
				tap((count) => {
					this.hasNext = count > this.skip * this.take;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public load(): void {
		this.action.dispatch(
			PluginMarketplaceActions.getAll({
				skip: this.skip,
				take: this.take,
				relations: ['versions'],
				order: { createdAt: 'DESC', versions: { createdAt: 'DESC' } }
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
		this.skip = 0;
		this.hasNext = false;
		this.action.dispatch(PluginMarketplaceActions.reset());
	}
}
