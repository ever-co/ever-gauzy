import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnDestroy,
	OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Data, Router } from '@angular/router';
import {
	ICurrency,
	IOrganization,
	ITag,
	CrudActionEnum
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { debounceTime } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import {
	ErrorHandlingService,
	OrganizationEditStore,
	OrganizationsService,
	Store,
	ToastrService
} from '../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-main',
	templateUrl: './edit-organization-main.component.html',
	styleUrls: ['./edit-organization-main.component.scss']
})
export class EditOrganizationMainComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {

	imageUrl: string;
	hoverState: boolean;
	employeesCount: number;

	@Input() organization: IOrganization;

	/*
	* Organization Mutation Form
	*/
	public form: FormGroup = EditOrganizationMainComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			tags: [null],
			currency: [null, Validators.required],
			name: [null, Validators.required],
			officialName: [null],
			profile_link: [null, [
					Validators.required,
					Validators.pattern('^[a-z0-9-]+$')
				]
			],
			taxId: [null],
			registrationDate: [null],
			website: [null]
		});
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly fb: FormBuilder,
		private readonly organizationService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly cdr: ChangeDetectorRef,
		private readonly errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.parent.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data: Data) => !!data && !!data.organization),
				tap(
					({ employeesCount }) =>
						(this.employeesCount = employeesCount)
				),
				map(({ organization }) => organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				tap((organization: IOrganization) => (this.imageUrl = organization.imageUrl)),
				tap(() => this._setFormValues()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void { }

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
	}

	handleImageUploadError(event: any) { }

	/**
	 * Update organization main settings
	 *
	 * @returns
	 */
	async updateOrganizationSettings() {
		if (!this.organization || this.form.invalid) {
			return;
		}
		try {
			const organization = await this.organizationService.update(this.organization.id, {
				imageUrl: this.imageUrl,
				defaultValueDateType: this.organization.defaultValueDateType,
				...this.form.getRawValue()
			});
			if (organization) {
				this.organizationEditStore.organizationAction = {
					organization,
					action: CrudActionEnum.UPDATED
				};
				this.store.selectedOrganization = organization;
			}
			if (this.organization) {
				this.toastrService.success(`TOASTR.MESSAGE.MAIN_ORGANIZATION_UPDATED`, {
					name: this.organization.name
				});
			}
			this.router.navigate([`/pages/organizations`]);
		} catch (error) {
			console.log('Error while updating organization main details', error);
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * Pre filled default form fields
	 *
	 * @returns
	 */
	private _setFormValues() {
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
			website: this.organization.website,
			registrationDate: this.organization.registrationDate
				? new Date(this.organization.registrationDate)
				: null
		});
		this.form.updateValueAndValidity();
	}

	/**
	 * On Changed Tags Event Emitter
	 *
	 * @param tags
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}
}
