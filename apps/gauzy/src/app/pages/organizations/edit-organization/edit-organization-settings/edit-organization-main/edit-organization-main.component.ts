import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CurrenciesEnum, IOrganization, ITag } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	organization: IOrganization;
	imageUrl: string;
	hoverState: boolean;
	employeesCount: number;
	form: FormGroup;
	currencies: string[] = Object.values(CurrenciesEnum);
	tags: ITag[] = [];
	selectedTags: any;

	constructor(
		private fb: FormBuilder,
		private employeesService: EmployeesService,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
	}

	handleImageUploadError(event: any) {}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this._initializeForm();
					this.imageUrl = this.organization.imageUrl;
					this.loadEmployeesCount();
				}
			});
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private async loadEmployeesCount() {
		const { id: organizationId, tenantId } = this.organization;
		const { total } = await this.employeesService
			.getAll([], { organization: { id: organizationId }, tenantId })
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
		const currentURL = window.location.href;
		window.location.href = currentURL.substring(
			0,
			currentURL.indexOf('/settings')
		);
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

	selectedTagsEvent(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}
}
