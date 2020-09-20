import { Component, OnInit, Input } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { ICountry, IOrganization } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CountryService } from '../../../../@core/services/country.service';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';

export enum ListsInputType {
	DEPARTMENTS = 'DEPARTMENTS',
	POSITIONS = 'POSITIONS',
	VENDORS = 'VENDORS'
}

@Component({
	selector: 'ngx-edit-organization-settings',
	templateUrl: './edit-organization-settings.component.html',
	styleUrls: [
		'./edit-organization-settings.component.scss',
		'../../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	],
	providers: [CountryService]
})
export class EditOrganizationSettingsComponent extends TranslationBaseComponent
	implements OnInit {
	@Input() organization: IOrganization;

	departments: string[] = [];
	positions: string[] = [];
	vendors: string[] = [];
	employeesCount: number;
	countries: ICountry[] = [];
	test: any;

	private _ngOnDestroy$ = new Subject();
	routeParams: Params;
	tabs: any[];

	constructor(
		private route: ActivatedRoute,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngOnDestroy$))
			.subscribe((params) => {
				this.routeParams = params;
			});

		this.loadTabs();
		this._applyTranslationOnTabs();
	}

	getRoute(tabName: string) {
		return `/pages/organizations/edit/${this.routeParams.id}/${tabName}`;
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
			.pipe(takeUntil(this._ngOnDestroy$))
			.subscribe(() => {
				this.loadTabs();
			});
	}
}
