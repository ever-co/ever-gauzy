import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnDestroy,
	OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	ICurrency,
	IOrganization,
	ITag,
	OrganizationAction
} from '@gauzy/models';
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
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	organization: IOrganization;
	imageUrl: string;
	hoverState: boolean;
	employeesCount: number;
	form: FormGroup;
	tags: ITag[] = [];
	selectedTags: any;
	currency: string;

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private employeesService: EmployeesService,
		private organizationService: OrganizationsService,
		private toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService,
		private store: Store,
		private cdr: ChangeDetectorRef,
		private errorHandler: ErrorHandlingService
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
				console.log(organization);
				this.imageUrl = organization.imageUrl;
				this._loadOrganizationData(organization);
			});
	}

	ngOnDestroy(): void {}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

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
		try {
			this.organizationService
				.update(this.organization.id, {
					imageUrl: this.imageUrl,
					...this.form.getRawValue()
				})
				.then((organization: IOrganization) => {
					this.organizationEditStore.organizationAction = {
						organization,
						action: OrganizationAction.UPDATED
					};
					this.toastrService.primary(
						this.organization.name +
							' organization main info updated.',
						'Success'
					);
				})
				.catch((error) => {
					this.errorHandler.handleError(error);
				});

			this.goBack();
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	goBack() {
		this.router.navigate([`/pages/organizations`]);
	}

	private _initializeForm() {
		this.form = this.fb.group({
			tags: [''],
			currency: ['', Validators.required],
			name: ['', Validators.required],
			officialName: [''],
			profile_link: [''],
			taxId: [''],
			registrationDate: [''],
			website: ['']
		});
		setTimeout(() => {
			this._setValues();
		}, 100);
	}

	private _setValues() {
		if (!this.organization) {
			return;
		}
		this.form.setValue({
			tags: this.organization.tags,
			currency: this.organization.currency,
			name: this.organization.name,
			officialName: this.organization.officialName,
			profile_link: this.organization.profile_link,
			taxId: this.organization.taxId,
			registrationDate: this.organization.registrationDate
				? new Date(this.organization.registrationDate)
				: null,
			website: this.organization.website
		});
		this.form.updateValueAndValidity();
		this.currency = this.organization.currency;
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

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
