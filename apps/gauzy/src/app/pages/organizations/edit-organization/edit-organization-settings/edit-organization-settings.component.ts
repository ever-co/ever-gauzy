import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization } from '@gauzy/contracts';
import { NbRouteTab } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-organization-settings',
	templateUrl: './edit-organization-settings.component.html',
	styleUrls: [
		'./edit-organization-settings.component.scss',
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class EditOrganizationSettingsComponent extends TranslationBaseComponent
	implements OnInit {

	@Input() organization: IOrganization;
	tabs: NbRouteTab[] = [];

	constructor(
		private readonly route: ActivatedRoute,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	getRoute(tab: string) {
		return `/pages/organizations/edit/${this.route.snapshot.paramMap.get('id')}/${tab}`;
	}

	loadTabs() {
		this.tabs = [
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.MAIN'),
				icon: 'person-outline',
				responsive: true,
				route: this.getRoute('main')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.LOCATION'),
				icon: 'pin-outline',
				responsive: true,
				route: this.getRoute('location')
			},
			{
				title: this.getTranslation('ORGANIZATIONS_PAGE.SETTINGS'),
				icon: 'settings-outline',
				responsive: true,
				route: this.getRoute('settings')
			}
		];
	}

	private _applyTranslationOnTabs() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadTabs()),
				untilDestroyed(this)
			)
			.subscribe();
	}
}
