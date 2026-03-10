import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbMenuItem, NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs';
import { SimStoreService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
const INTEGRATION_SIM_PAGE_LINK = '/pages/integrations/sim';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sim',
	templateUrl: './sim.component.html',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimComponent extends TranslationBaseComponent implements OnInit {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _simStoreService = inject(SimStoreService);

	tabs: NbRouteTab[] = [];
	menus: NbMenuItem[] = [];
	integrationId: string = '';

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit(): void {
		this._activatedRoute.params
			.pipe(
				filter((params) => !!params['id']),
				tap((params) => {
					this.integrationId = params['id'];
					this._simStoreService.setSelectedIntegrationId(this.integrationId);
					this._buildTabs();
					this._buildMenus();
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this._buildTabs();
			this._buildMenus();
		});
	}

	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	private _buildTabs(): void {
		this.tabs = [
			{
				title: this.getTranslation('INTEGRATIONS.SIM_PAGE.EXECUTIONS.TITLE'),
				icon: 'list-outline',
				route: `${INTEGRATION_SIM_PAGE_LINK}/${this.integrationId}/executions`,
				responsive: true,
				activeLinkOptions: { exact: false }
			},
			{
				title: this.getTranslation('INTEGRATIONS.SIM_PAGE.WORKFLOWS.TITLE'),
				icon: 'flash-outline',
				route: `${INTEGRATION_SIM_PAGE_LINK}/${this.integrationId}/workflows`,
				responsive: true,
				activeLinkOptions: { exact: false }
			},
			{
				title: this.getTranslation('INTEGRATIONS.SIM_PAGE.EVENT_TRIGGERS.TITLE'),
				icon: 'bell-outline',
				route: `${INTEGRATION_SIM_PAGE_LINK}/${this.integrationId}/event-triggers`,
				responsive: true,
				activeLinkOptions: { exact: false }
			}
		];
	}

	private _buildMenus(): void {
		this.menus = [
			{
				title: this.getTranslation('INTEGRATIONS.RE_INTEGRATE'),
				link: `${INTEGRATION_SIM_PAGE_LINK}/regenerate`
			}
		];
	}
}
