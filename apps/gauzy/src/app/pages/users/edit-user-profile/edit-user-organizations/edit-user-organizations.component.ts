import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Organization } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UsersOrganizationsService } from 'apps/gauzy/src/app/@core/services/users-organizations.service';
import { UsersService } from 'apps/gauzy/src/app/@core/services';
import { Params, ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ngx-edit-user-organization',
	templateUrl: './edit-user-organizations.component.html'
})
export class EditUserOrganizationsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@Input()
	organization: Organization;

	form: FormGroup;
	organizations: string[];
	selectedOrganizationsId: string[];
	routeParams: Params;

	constructor(
		private route: ActivatedRoute,
		private readonly fb: FormBuilder,
		private organizationsService: OrganizationsService,
		private store: Store,
		private usersOrganizationService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private readonly usersService: UsersService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				console.log(params);
				this.routeParams = params;
				this._loadOrganizations();
			});

		this._initializeForm();
	}

	private async _initializeForm() {
		this.form = this.fb.group({
			organizations: this.organizations
		});
	}

	private async _loadOrganizations() {
		const all_orgs = this.organizationsService.getAll();

		const { id } = this.routeParams;

		const { items } = await this.usersOrganizationService.getAll();

		const allOrgs = [];
		all_orgs.then((orgs) => {
			for (let i = 0; i < orgs.items.length; i++) {
				allOrgs.push({
					id: orgs.items[i].id,
					name: orgs.items[i].name,
					imageUrl: orgs.items[i].imageUrl
				});
			}

			this.organizations = allOrgs;
		});
	}

	onOrganizationsSelected(organizations: string[]) {
		this.selectedOrganizationsId = organizations;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
