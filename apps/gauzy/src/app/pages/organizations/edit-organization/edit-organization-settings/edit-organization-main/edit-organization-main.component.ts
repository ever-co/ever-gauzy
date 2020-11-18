import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CurrenciesEnum, IOrganization, ITag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { filter, first } from 'rxjs/operators';
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../../../@core/services/store.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: IOrganization;
	imageUrl: string;
	hoverState: boolean;
	employeesCount: number;
	form: FormGroup;
	currencies: string[] = Object.values(CurrenciesEnum);
	tags: ITag[] = [];
	selectedTags: any;

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private employeesService: EmployeesService,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService,
		private store: Store
	) {
		super(translateService);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
	}

	handleImageUploadError(event: any) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.imageUrl = organization.imageUrl;
				this._loadOrganizationData(organization);
			});
	}

	ngOnDestroy(): void {}

	private async loadEmployeesCount() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { total } = await this.employeesService
			.getAll([], { organizationId, tenantId })
			.pipe(first())
			.toPromise();

		this.employeesCount = total;
	}

	async updateOrganizationSettings() {
		this.organizationService.update(this.organization.id, {
			imageUrl: this.imageUrl,
			...this.form.getRawValue()
		});
		this.toastrService.primary(
			this.organization.name + ' organization main info updated.',
			'Success'
		);
		this.goBack();
	}

	goBack() {
		this.router.navigate([`/pages/organizations`]);
	}

	private _initializeForm() {
		if (!this.organization) {
			return;
		}
		this.form = this.fb.group({
			tags: [this.organization.tags],
			currency: [this.organization.currency, Validators.required],
			name: [this.organization.name, Validators.required],
			officialName: [this.organization.officialName],
			profile_link: [this.organization.profile_link],
			taxId: [this.organization.taxId],
			registrationDate: [
				this.organization.registrationDate
					? new Date(this.organization.registrationDate)
					: null
			],
			website: [this.organization.website]
		});
		this.tags = this.form.get('tags').value || [];
	}

	private async _loadOrganizationData(organization) {
		if (!organization) {
			return;
		}
		const id = organization.id;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationService.getAll(
			['contact', 'tags'],
			{
				id,
				tenantId
			}
		);
		this.organization = items[0];
		this.organizationEditStore.selectedOrganization = this.organization;

		this.loadEmployeesCount();
		this._initializeForm();
	}

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
}
