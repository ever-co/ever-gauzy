import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
	AlignmentOptions,
	DefaultValueDateTypeEnum,
	IOrganization,
	WeekDaysEnum,
	RegionsEnum,
	BonusTypeEnum,
	CurrencyPosition,
	AccountingTemplateTypeEnum,
	IAccountingTemplate,
	CurrenciesEnum,
	DEFAULT_DATE_FORMATS,
	CrudActionEnum,
	IKeyValuePair,
	DEFAULT_TIME_FORMATS
} from '@gauzy/contracts';
import { formatDate } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, switchMap, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { NbAccordionComponent, NbAccordionItemComponent, NbThemeService } from "@nebular/theme";
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	AccountingTemplateService,
	OrganizationEditStore,
	OrganizationsService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { NotesWithTagsComponent } from 'apps/gauzy/src/app/@shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-other-settings',
	templateUrl: './edit-organization-other-settings.component.html',
	styleUrls: ['./edit-organization-other-settings.component.scss']
})
export class EditOrganizationOtherSettingsComponent extends NotesWithTagsComponent
	implements OnInit, OnDestroy {

	public organization: IOrganization;
	form: FormGroup;
	defaultOrganizationSelection: IKeyValuePair[] = [
		{ key: 'Yes', value: true }, 
		{ key: 'No', value: false }
	];
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultAlignmentTypes: string[] = Object.values(AlignmentOptions).map(
		(type) => {
			return type[0] + type.substring(1, type.length).toLowerCase();
		}
	);
	defaultCurrencyPosition: string[] = Object.values(CurrencyPosition);
	defaultBonusTypes: string[] = Object.values(BonusTypeEnum);
	invoiceTemplates: IAccountingTemplate[] = [];
	estimateTemplates: IAccountingTemplate[] = [];
	receiptTemplates: IAccountingTemplate[] = [];
	selectedInvoiceTemplate: IAccountingTemplate;
	selectedEstimateTemplate: IAccountingTemplate;
	selectedReceiptTemplate: IAccountingTemplate;

	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	listOfDateFormats = DEFAULT_DATE_FORMATS;
	listOfTimeFormats = DEFAULT_TIME_FORMATS;
	numberFormats = ['USD', 'BGN', 'ILS'];
	numberFormat: string;
	weekdays: string[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	regions = Object.values(RegionsEnum);
	
	/**
	 * Nebular Accordion Main Component
	 */
	@ViewChild('accordion') accordion: NbAccordionComponent;

	/**
	 * Nebular Accordion Item Components
	 */
	@ViewChild('general') set general(general: NbAccordionItemComponent) { 
		if (general) {
			general.open();
			this.cdr.detectChanges();
		}
	}
	@ViewChild('design') design: NbAccordionItemComponent;
	@ViewChild('accounting') accounting: NbAccordionItemComponent;
	@ViewChild('bonus') bonus: NbAccordionItemComponent;
	@ViewChild('invites') invites: NbAccordionItemComponent;
	@ViewChild('dateLimit') dateLimit: NbAccordionItemComponent;
	@ViewChild('timer') timer: NbAccordionItemComponent;

	constructor(
		private readonly router: Router,
		private readonly fb: FormBuilder,
		private readonly cdr: ChangeDetectorRef,
		private readonly organizationService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly accountingTemplateService: AccountingTemplateService,
		public readonly themeService: NbThemeService
	) {
		super(themeService, translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				switchMap((organization) => this.organizationService.getById(organization.id, null, [
					'contact',
					'tags',
					'accountingTemplates'
				])),
				tap((organization: IOrganization) => this._loadOrganizationData(organization)),
				tap((organization: IOrganization) => this.regionCode = organization.regionCode),
				tap(() => this.getTemplates()),
				untilDestroyed(this)
			)
			.subscribe();
	}
	
	getTimeWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');
		return '(' + offset + ') ' + cutZone;
	}

	dateFormatPreview(format: string) {
		this.form.valueChanges
			.pipe(
				tap(({ regionCode }) => this.regionCode = regionCode),
				untilDestroyed(this)
			)
			.subscribe();
		return moment().locale(this.regionCode).format(format);
	}

	numberFormatPreview(format: string) {
		const number = 12345.67;
		let code: string;
		switch (format) {
			case CurrenciesEnum.BGN:
				code = 'bg';
				break;
			case CurrenciesEnum.USD:
				code = 'en';
				break;
			case CurrenciesEnum.ILS:
				code = 'he';
				break;
		}
		return number.toLocaleString(`${code}`, {
			style: 'currency',
			currency: `${format}`,
			currencyDisplay: 'symbol'
		});
	}

	

	async updateOrganizationSettings() {
		this.organizationService
			.update(this.organization.id, this.form.getRawValue())
			.then((organization: IOrganization) => {
				if (organization) {
					this.organizationEditStore.organizationAction = {
						organization,
						action: CrudActionEnum.UPDATED
					};
					this.store.selectedOrganization = organization;
				}
			});

		await this.saveTemplate(this.selectedInvoiceTemplate);
		await this.saveTemplate(this.selectedEstimateTemplate);
		await this.saveTemplate(this.selectedReceiptTemplate);

		this.toastrService.success(
			`TOASTR.MESSAGE.ORGANIZATION_SETTINGS_UPDATED`,
			{
				name: this.organization.name
			}
		);
		this.goBack();
	}

	goBack() {
		this.router.navigate([
			`/pages/organizations/edit/${this.organization.id}`
		]);
	}

	loadDefaultBonusPercentage(bonusType: BonusTypeEnum) {
		const bonusPercentageControl = this.form.get('bonusPercentage');

		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				bonusPercentageControl.setValue(75);
				bonusPercentageControl.enable();
				break;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				bonusPercentageControl.setValue(10);
				bonusPercentageControl.enable();
				break;
			default:
				bonusPercentageControl.setValue(null);
				bonusPercentageControl.disable();
				break;
		}
	}
	private _initializedForm() {
		if (!this.organization) {
			return;
		}

		this.form = this.fb.group({
			name: [this.organization.name],
			currency: [this.organization.currency],
			defaultValueDateType: [
				this.organization.defaultValueDateType,
				Validators.required
			],
			regionCode: [this.organization.regionCode],
			defaultAlignmentType: [this.organization.defaultAlignmentType],
			brandColor: [this.organization.brandColor],
			dateFormat: [this.organization.dateFormat],
			timeZone: [this.organization.timeZone],
			startWeekOn: [this.organization.startWeekOn],
			defaultStartTime: [this.organization.defaultStartTime],
			defaultEndTime: [this.organization.defaultEndTime],
			numberFormat: [this.organization.numberFormat],
			bonusType: [this.organization.bonusType],
			bonusPercentage: [
				{
					value: this.organization.bonusPercentage,
					disabled: !this.organization.bonusType
				},
				[Validators.min(0), Validators.max(100)]
			],
			invitesAllowed: [this.organization.invitesAllowed || false],
			inviteExpiryPeriod: [
				{
					value: this.organization.inviteExpiryPeriod || 7,
					disabled: !this.organization.invitesAllowed
				},
				[Validators.min(1)]
			],
			fiscalStartDate: [
				formatDate(
					new Date(`01/01/${new Date().getFullYear()}`),
					'yyyy-MM-dd',
					'en'
				)
			],
			fiscalEndDate: [
				formatDate(
					new Date(`12/31/${new Date().getFullYear()}`),
					'yyyy-MM-dd',
					'en'
				)
			],
			futureDateAllowed: [this.organization.futureDateAllowed || false],
			allowManualTime: [this.organization.allowManualTime],
			allowModifyTime: [this.organization.allowModifyTime],
			allowDeleteTime: [this.organization.allowDeleteTime],
			requireReason: [this.organization.requireReason],
			requireDescription: [this.organization.requireDescription],
			requireProject: [this.organization.requireProject],
			requireTask: [this.organization.requireTask],
			requireClient: [this.organization.requireClient],
			timeFormat: [this.organization.timeFormat || 12],
			separateInvoiceItemTaxAndDiscount: [
				this.organization.separateInvoiceItemTaxAndDiscount
			],
			defaultInvoiceEstimateTerms: [
				this.organization.defaultInvoiceEstimateTerms || ''
			],
			fiscalInformation: [this.organization.fiscalInformation || ''],
			currencyPosition: [this.organization.currencyPosition || 'LEFT'],
			discountAfterTax: [this.organization.discountAfterTax],
			convertAcceptedEstimates: [
				this.organization.convertAcceptedEstimates || false
			],
			daysUntilDue: [this.organization.daysUntilDue || null],
			invoiceTemplate: [
				this.selectedInvoiceTemplate
					? this.selectedInvoiceTemplate.id
					: null
			],
			estimateTemplate: [
				this.selectedEstimateTemplate
					? this.selectedEstimateTemplate.id
					: null
			],
			receiptTemplate: [
				this.selectedReceiptTemplate
					? this.selectedReceiptTemplate.id
					: null
			],
			isDefault: [this.organization.isDefault]
		});
	}

	toggleSeparateTaxing($event) {
		this.organization.separateInvoiceItemTaxAndDiscount = $event;
	}

	toggleExpiry(checked) {
		const inviteExpiryControl = this.form.get('inviteExpiryPeriod');
		checked ? inviteExpiryControl.enable() : inviteExpiryControl.disable();
	}

	toggleDiscountAfterTax($event) {
		this.organization.discountAfterTax = $event;
	}

	toggleEstimateConverting($event) {
		this.organization.convertAcceptedEstimates = $event;
	}

	async getTemplates() {
		const result = await this.accountingTemplateService.getAll(
			['organization'],
			{
				languageCode: this.store.preferredLanguage
			}
		);

		result.items.forEach((item) => {
			switch (item.templateType) {
				case AccountingTemplateTypeEnum.INVOICE:
					this.invoiceTemplates.push(item);
					break;
				case AccountingTemplateTypeEnum.ESTIMATE:
					this.estimateTemplates.push(item);
					break;
				case AccountingTemplateTypeEnum.RECEIPT:
					this.receiptTemplates.push(item);
					break;
				default:
					break;
			}
		});
	}

	async selectTemplate(event) {
		const template = await this.accountingTemplateService.getById(event);
		template['organization'] = this.organization;
		template['organizationId'] = this.organization.id;
		switch (template.templateType) {
			case AccountingTemplateTypeEnum.INVOICE:
				this.selectedInvoiceTemplate = template;
				break;
			case AccountingTemplateTypeEnum.ESTIMATE:
				this.selectedEstimateTemplate = template;
				break;
			case AccountingTemplateTypeEnum.RECEIPT:
				this.selectedReceiptTemplate = template;
				break;
			default:
				break;
		}
	}

	async saveTemplate(template: IAccountingTemplate) {
		if (template) {
			await this.accountingTemplateService.updateTemplate(
				template.id,
				template
			);
		}
	}

	private _loadOrganizationData(organization: IOrganization) {
		if (!organization) {
			return;
		}
		this.organization = organization;
		this.organizationEditStore.selectedOrganization = this.organization;

		if (this.organization.accountingTemplates) {
			this.organization.accountingTemplates.forEach((template) => {
				switch (template.templateType) {
					case AccountingTemplateTypeEnum.INVOICE:
						this.selectedInvoiceTemplate = template;
						break;
					case AccountingTemplateTypeEnum.ESTIMATE:
						this.selectedEstimateTemplate = template;
						break;
					case AccountingTemplateTypeEnum.RECEIPT:
						this.selectedReceiptTemplate = template;
						break;
					default:
						break;
				}
			});
		}

		this._initializedForm();
	}

	ngOnDestroy() {}
}
