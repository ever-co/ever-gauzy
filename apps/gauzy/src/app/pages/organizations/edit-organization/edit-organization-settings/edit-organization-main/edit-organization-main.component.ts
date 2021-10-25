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
	CrudActionEnum
} from '@gauzy/contracts';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../../../@core/services/store.service';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

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
		private readonly router: Router,
		private readonly fb: FormBuilder,
		private readonly employeesService: EmployeesService,
		private readonly organizationService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly cdr: ChangeDetectorRef,
		private readonly errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
	}

	handleImageUploadError(event: any) { }

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				tap((organization) => (this.imageUrl = organization.imageUrl)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this._loadOrganizationData(organization);
			});
	}

	ngOnDestroy(): void { }

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	private async loadEmployeesCount() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { total } = await firstValueFrom(
			this.employeesService
				.getAll([], { organizationId, tenantId })
		);

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
					if (organization) {
						this.organizationEditStore.organizationAction = {
							organization,
							action: CrudActionEnum.UPDATED
						};
						this.store.selectedOrganization = organization;
					}

					this.toastrService.success(
						`TOASTR.MESSAGE.MAIN_ORGANIZATION_UPDATED`,
						{
							name: this.organization.name
						}
					);
					this.goBack();
				})
				.catch((error) => {
					this.errorHandler.handleError(error);
				});
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
			profile_link: ['', [
				Validators.required,
				Validators.pattern('^[a-z0-9-]+$')
			]
			],
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
		this.form.patchValue({
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
		this.currency = this.organization.currency;
		this.tags = this.form.get('tags').value || [];
	}

	private async _loadOrganizationData(organization) {
		if (!organization) {
			return;
		}
		const { id } = organization;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationService.getAll(
			['contact', 'tags'],
			{ id, tenantId }
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
	currencyChanged($event: ICurrency) { }
}
