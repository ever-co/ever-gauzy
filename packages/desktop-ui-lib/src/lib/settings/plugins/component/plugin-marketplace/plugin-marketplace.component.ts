import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import { PluginMarketplaceActions } from './+state/actions/plugin-marketplace.action';
import { PluginMarketplaceQuery } from './+state/queries/plugin-marketplace.query';
import { PluginMarketplaceUploadComponent } from './plugin-marketplace-upload/plugin-marketplace-upload.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace',
	templateUrl: './plugin-marketplace.component.html',
	styleUrls: ['./plugin-marketplace.component.scss']
})
export class PluginMarketplaceComponent implements OnInit {
	constructor(
		private readonly dialog: NbDialogService,
		private readonly route: ActivatedRoute,
		private readonly action: Actions,
		public readonly query: PluginMarketplaceQuery
	) {}

	ngOnInit(): void {
		this.load();
	}

	public load(): void {
		this.action.dispatch(
			PluginMarketplaceActions.getAll({
				relations: ['versions'],
				order: { createdAt: 'DESC', versions: { createdAt: 'DESC' } }
			})
		);
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
}
