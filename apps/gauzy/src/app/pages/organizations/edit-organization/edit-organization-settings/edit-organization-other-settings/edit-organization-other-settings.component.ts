import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { Component, OnInit, OnDestroy } from '@angular/core';
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
	CrudActionEnum
} from '@gauzy/contracts';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { formatDate } from '@angular/common';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Store } from '../../../../../@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { AccountingTemplateService } from 'apps/gauzy/src/app/@core/services/accounting-template.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-other-settings',
	templateUrl: './edit-organization-other-settings.component.html',
	styleUrls: ['./edit-organization-other-settings.component.scss']
})
export class EditOrganizationOtherSettingsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organization: IOrganization;
	form: FormGroup;

	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultAlignmentTypes: string[] = Object.values(AlignmentOptions).map(
		(type) => {
			return type[0] + type.substr(1, type.length).toLowerCase();
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
	numberFormats = ['USD', 'BGN', 'ILS'];
	numberFormat: string;
	weekdays: string[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	regions = Object.values(RegionsEnum);

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private organizationService: OrganizationsService,
		private toastrService: ToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService,
		private store: Store,
		private accountingTemlateService: AccountingTemplateService
	) {
		super(translateService);
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
		this.form.valueChanges.pipe(untilDestroyed(this)).subscribe((val) => {
			this.regionCode = val.regionCode;
		});

		moment.locale(this.regionCode);
		return moment().format(format);
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

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this._loadOrganizationData(organization);
				this.getTemplates();
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
			]
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
		const result = await this.accountingTemlateService.getAll(
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
		const template = await this.accountingTemlateService.getById(event);
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
			await this.accountingTemlateService.updateTemplate(
				template.id,
				template
			);
		}
	}

	private async _loadOrganizationData(organization) {
		if (!organization) {
			return;
		}
		const id = organization.id;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationService.getAll(
			['contact', 'tags', 'accountingTemplates'],
			{
				id,
				tenantId
			}
		);
		this.organization = items[0];
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
