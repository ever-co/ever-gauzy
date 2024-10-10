import { formatDate } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, FormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap, debounceTime, map } from 'rxjs/operators';
import * as moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbAccordionComponent, NbAccordionItemComponent, NbThemeService } from '@nebular/theme';
import {
	AccountingTemplateTypeEnum,
	AlignmentOptions,
	BonusTypeEnum,
	CrudActionEnum,
	CurrenciesEnum,
	CurrencyPosition,
	DEFAULT_ACTIVITY_PROOF_DURATIONS,
	DEFAULT_DATE_FORMATS,
	DEFAULT_INACTIVITY_TIME_LIMITS,
	DEFAULT_INVITE_EXPIRY_PERIOD,
	DEFAULT_PROFIT_BASED_BONUS,
	DEFAULT_REVENUE_BASED_BONUS,
	DEFAULT_TIME_FORMATS,
	DEFAULT_TASK_NOTIFY_PERIOD,
	DEFAULT_PROOF_COMPLETION_TYPE,
	DefaultValueDateTypeEnum,
	IAccountingTemplate,
	IKeyValuePair,
	IOrganization,
	RegionsEnum,
	WeekDaysEnum,
	IOrganizationTaskSetting,
	TaskProofOfCompletionTypeEnum,
	DEFAULT_AUTO_CLOSE_ISSUE_PERIOD,
	DEFAULT_AUTO_ARCHIVE_ISSUE_PERIOD,
	DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS,
	DEFAULT_STANDARD_WORK_HOURS_PER_DAY
} from '@gauzy/contracts';
import { isEmpty } from '@gauzy/ui-core/common';
import {
	AccountingTemplateService,
	OrganizationEditStore,
	OrganizationTaskSettingService,
	OrganizationsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { NotesWithTagsComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-org-other-settings',
	templateUrl: './edit-organization-other-settings.component.html',
	styleUrls: ['./edit-organization-other-settings.component.scss']
})
export class EditOrganizationOtherSettingsComponent
	extends NotesWithTagsComponent
	implements AfterViewInit, OnInit, OnDestroy
{
	public get isTrackInactivity(): boolean {
		return this.form.get('allowTrackInactivity').value;
	}

	public organization: IOrganization;
	public organizationTaskSetting: IOrganizationTaskSetting;
	defaultOrganizationSelection: IKeyValuePair[] = [
		{ key: 'Yes', value: true },
		{ key: 'No', value: false }
	];
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultAlignmentTypes: string[] = Object.values(AlignmentOptions);
	defaultCurrencyPosition: string[] = Object.values(CurrencyPosition);
	defaultBonusTypes: string[] = Object.values(BonusTypeEnum);
	defaultTaskProofOfCompletionTypes: string[] = Object.values(TaskProofOfCompletionTypeEnum);
	invoiceTemplates: IAccountingTemplate[] = [];
	estimateTemplates: IAccountingTemplate[] = [];
	receiptTemplates: IAccountingTemplate[] = [];
	selectedInvoiceTemplate: IAccountingTemplate;
	selectedEstimateTemplate: IAccountingTemplate;
	selectedReceiptTemplate: IAccountingTemplate;

	listOfDateFormats = DEFAULT_DATE_FORMATS;
	listOfTimeFormats = DEFAULT_TIME_FORMATS;
	listOfInactivityLimits = DEFAULT_INACTIVITY_TIME_LIMITS;
	listOfActivityProofDuration = DEFAULT_ACTIVITY_PROOF_DURATIONS;
	numberFormats = ['USD', 'BGN', 'ILS'];
	numberFormat: string;
	weekdays: WeekDaysEnum[] = Object.values(WeekDaysEnum);
	regionCodes = Object.keys(RegionsEnum);
	regionCode: string;
	regions = Object.values(RegionsEnum);
	screenshotFrequencyOptions = DEFAULT_SCREENSHOT_FREQUENCY_OPTIONS;
	standardWorkHoursPerDayOptions: number[] = Array.from({ length: 24 }, (_, i) => i + 1); // Creates an array from 1 to 24

	/*
	 * Organization Mutation Form
	 */
	public form: UntypedFormGroup = EditOrganizationOtherSettingsComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const currentYear = new Date().getFullYear();
		const startOfYear = formatDate(new Date(currentYear, 0, 1), 'yyyy-MM-dd', 'en'); // January 1st
		const endOfYear = formatDate(new Date(currentYear, 11, 31), 'yyyy-MM-dd', 'en'); // December 31st

		return fb.group({
			name: [],
			currency: [],
			defaultValueDateType: [null, Validators.required],
			regionCode: [],
			defaultAlignmentType: [],
			brandColor: [],
			dateFormat: [],
			timeZone: [],
			startWeekOn: [],
			defaultStartTime: [],
			defaultEndTime: [],
			numberFormat: [],
			bonusType: [],
			bonusPercentage: [],
			invitesAllowed: [false],
			inviteExpiryPeriod: [],
			fiscalStartDate: [startOfYear],
			fiscalEndDate: [endOfYear],
			futureDateAllowed: [false],
			allowManualTime: [],
			allowModifyTime: [],
			allowDeleteTime: [],
			allowTrackInactivity: [],
			inactivityTimeLimit: [1],
			activityProofDuration: [1],
			requireReason: [],
			requireDescription: [],
			requireProject: [],
			requireTask: [],
			requireClient: [],
			timeFormat: [12],
			separateInvoiceItemTaxAndDiscount: [],
			defaultInvoiceEstimateTerms: [],
			fiscalInformation: [],
			currencyPosition: [CurrencyPosition.LEFT],
			discountAfterTax: [],
			convertAcceptedEstimates: [false],
			daysUntilDue: [],
			invoiceTemplate: [],
			estimateTemplate: [],
			receiptTemplate: [],
			isDefault: [],
			isRemoveIdleTime: [false],
			allowScreenshotCapture: [true],
			upworkOrganizationId: [null],
			upworkOrganizationName: [null],
			randomScreenshot: [false],
			trackOnSleep: [false],
			screenshotFrequency: [10],
			enforced: [false],
			standardWorkHoursPerDay: [DEFAULT_STANDARD_WORK_HOURS_PER_DAY]
		});
	}

	/*
	 * Organization Task Setting
	 */
	public taskSettingForm: UntypedFormGroup = EditOrganizationOtherSettingsComponent.buildTaskSettingForm(this._fb);

	/**
	 * Nebular Accordion Item Components
	 */
	@ViewChild('general') general: NbAccordionItemComponent;
	@ViewChild('design') design: NbAccordionItemComponent;
	@ViewChild('accounting') accounting: NbAccordionItemComponent;
	@ViewChild('bonus') bonus: NbAccordionItemComponent;
	@ViewChild('invites') invites: NbAccordionItemComponent;
	@ViewChild('dateLimit') dateLimit: NbAccordionItemComponent;
	@ViewChild('timer') timer: NbAccordionItemComponent;
	@ViewChild('integrations') integrations: NbAccordionItemComponent;
	@ViewChild('taskSetting') taskSetting: NbAccordionItemComponent;

	/**
	 * Nebular Accordion Main Component
	 */
	accordion: NbAccordionComponent;
	@ViewChild('accordion') set content(content: NbAccordionComponent) {
		if (content) {
			this.accordion = content;
			this._cdr.detectChanges();
		}
	}

	static buildTaskSettingForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			isTasksPrivacyEnabled: [],
			isTasksMultipleAssigneesEnabled: [],
			isTasksManualTimeEnabled: [],
			isTasksGroupEstimationEnabled: [],
			isTasksEstimationInHoursEnabled: [],
			isTasksEstimationInStoryPointsEnabled: [],
			isTasksProofOfCompletionEnabled: [],
			tasksProofOfCompletionType: [], // Enum
			isTasksLinkedEnabled: [],
			isTasksCommentsEnabled: [],
			isTasksHistoryEnabled: [],
			isTasksAcceptanceCriteriaEnabled: [],
			isTasksDraftsEnabled: [],
			isTasksNotifyLeftEnabled: [],
			tasksNotifyLeftPeriodDays: [],
			isTasksAutoCloseEnabled: [],
			tasksAutoClosePeriodDays: [],
			isTasksAutoArchiveEnabled: [],
			tasksAutoArchivePeriodDays: [],
			isTasksAutoStatusEnabled: []
		});
	}

	/**
	 * Check if the form is enforced.
	 */
	public get isEnforced(): boolean {
		return this.form.get('enforced').value;
	}

	constructor(
		public readonly translateService: TranslateService,
		public readonly themeService: NbThemeService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _fb: UntypedFormBuilder,
		private readonly _cdr: ChangeDetectorRef,
		private readonly _organizationService: OrganizationsService,
		private readonly _organizationTaskSettingService: OrganizationTaskSettingService,
		private readonly _toastrService: ToastrService,
		private readonly _organizationEditStore: OrganizationEditStore,
		private readonly _store: Store,
		private readonly _accountingTemplateService: AccountingTemplateService
	) {
		super(themeService, translateService);
	}

	ngOnInit(): void {
		this._route.parent.data
			.pipe(
				debounceTime(100),
				filter((data) => {
					return !!data && (!!data.organization || !!data.organizationTaskSetting);
				}),
				map(({ organization, organizationTaskSetting }) => {
					return { organization, organizationTaskSetting };
				}),
				tap((data: { organization: IOrganization; organizationTaskSetting: IOrganizationTaskSetting }) => {
					this.organization = data.organization;
					this.organizationTaskSetting = data.organizationTaskSetting;
				}),
				tap(
					(data: { organization: IOrganization; organizationTaskSetting: IOrganizationTaskSetting }) =>
						(this.regionCode = data.organization.regionCode)
				),
				tap(() => this._setFormValues()),
				tap(() => this._getTemplates()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		/**
		 * Organization upwork organization integration ID controls value changes
		 */
		const upworkOrganizationId = <FormControl>this.form.get('upworkOrganizationId');
		const upworkOrganizationName = <FormControl>this.form.get('upworkOrganizationName');

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		upworkOrganizationId.valueChanges
			.pipe(
				tap((value: IOrganization['upworkOrganizationId']) => {
					if (value) {
						upworkOrganizationName.setValidators([Validators.required]);
					} else {
						upworkOrganizationName.setValidators(null);
					}
					upworkOrganizationName.updateValueAndValidity();
				})
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const regionCode = <FormControl>this.form.get('regionCode');
		regionCode.valueChanges
			.pipe(
				tap((value: IOrganization['regionCode']) => (this.regionCode = value)),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const bonusTypeControl = <FormControl>this.form.get('bonusType');
		bonusTypeControl.valueChanges
			.pipe(
				tap((bonusType: IOrganization['bonusType']) => {
					this.onChangedBonusPercentage(bonusType as BonusTypeEnum);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const invitesAllowedControl = <FormControl>this.form.get('invitesAllowed');
		invitesAllowedControl.valueChanges
			.pipe(
				tap((invitesAllowed: IOrganization['invitesAllowed']) => {
					this.toggleInviteExpiryPeriod(invitesAllowed);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const isTasksProofOfCompletionEnabledControl = <FormControl>(
			this.taskSettingForm.get('isTasksProofOfCompletionEnabled')
		);
		isTasksProofOfCompletionEnabledControl.valueChanges
			.pipe(
				tap((taskProofOfCompletionEnabled: IOrganizationTaskSetting['isTasksProofOfCompletionEnabled']) => {
					this.toggleTasksProofOfCompletionType(taskProofOfCompletionEnabled);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const isTasksNotifyLeftEnabledControl = <FormControl>this.taskSettingForm.get('isTasksNotifyLeftEnabled');
		isTasksNotifyLeftEnabledControl.valueChanges
			.pipe(
				tap((taskNotifyEnabled: IOrganizationTaskSetting['isTasksNotifyLeftEnabled']) => {
					this.toggleTasksNotifyLeftPeriodDays(taskNotifyEnabled);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const isTasksAutoCloseEnabledControl = <FormControl>this.taskSettingForm.get('isTasksAutoCloseEnabled');
		isTasksAutoCloseEnabledControl.valueChanges
			.pipe(
				tap((taskAutoCloseEnabled: IOrganizationTaskSetting['isTasksAutoCloseEnabled']) => {
					this.toggleTasksAutoClosePeriodDays(taskAutoCloseEnabled);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		/**
		 * Emits an event every time the value of the control changes.
		 * It also emits an event each time you call enable() or disable()
		 */
		const isTasksAutoArchiveEnabledControl = <FormControl>this.taskSettingForm.get('isTasksAutoArchiveEnabled');
		isTasksAutoArchiveEnabledControl.valueChanges
			.pipe(
				tap((taskAutoArchiveEnabled: IOrganizationTaskSetting['isTasksAutoArchiveEnabled']) => {
					this.toggleTasksAutoArchivePeriodDays(taskAutoArchiveEnabled);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Returns a preview of the current date based on the specified date format
	 * and the regionCode locale (defaults to English if none is provided).
	 *
	 * @param format - A string representing the desired date format (e.g., 'YYYY-MM-DD')
	 * @returns A formatted date string based on the specified format
	 */
	dateFormatPreview(format: string): string | undefined {
		if (!format) return;

		const locale = this.regionCode || RegionsEnum.EN;
		return moment().locale(locale).format(format);
	}

	/**
	 * Returns a preview of a formatted number (e.g., 12345.67) based on the specified currency format.
	 * The function selects the appropriate locale based on the provided currency and formats the number.
	 *
	 * @param format - A string representing the desired currency format (e.g., 'USD', 'BGN', 'ILS')
	 * @returns A formatted number string in the specified currency
	 */
	numberFormatPreview(format: string): string {
		const number = 12345.67;
		const currencyLocaleMap = {
			[CurrenciesEnum.BGN]: 'bg', // Bulgarian
			[CurrenciesEnum.USD]: 'en', // US English
			[CurrenciesEnum.ILS]: 'he' // Hebrew (Israel)
		};

		// Get the locale code based on the provided currency format
		const locale = currencyLocaleMap[format] || 'en'; // Default to 'en' if no match

		// Format the number using the selected locale
		return number.toLocaleString(locale, {
			style: 'currency',
			currency: format,
			currencyDisplay: 'symbol'
		});
	}

	/**
	 * Update organization settings
	 */
	async updateOrganizationSettings(): Promise<void> {
		// Validate the form and check if organization exists
		if (this.form.invalid || !this.organization) {
			return;
		}

		try {
			// Extract organization ID and update organization settings
			const { id: organizationId, name } = this.organization;
			const organization: IOrganization = await this._organizationService.update(organizationId, this.form.value);

			// Update the organization in the store
			this._organizationEditStore.organizationAction = {
				organization,
				action: CrudActionEnum.UPDATED
			};
			this._store.selectedOrganization = organization;
		} catch (error) {
			console.error('Error while updating organization settings', error);
			return; // Exit early if an error occurs
		}

		// Update organization task settings
		this.updateOrganizationTaskSetting();

		// Save selected templates
		await this.saveTemplate(this.selectedInvoiceTemplate);
		await this.saveTemplate(this.selectedEstimateTemplate);
		await this.saveTemplate(this.selectedReceiptTemplate);

		// Show success message
		this._toastrService.success(`TOASTR.MESSAGE.ORGANIZATION_SETTINGS_UPDATED`, { name });

		// Navigate back
		this.goBack();
	}

	/**
	 * Update organization task settings.
	 *
	 * @returns A subscription for the create or update operation.
	 *
	 * @throws Throws an error and displays a toastr message if the operation fails.
	 */
	updateOrganizationTaskSetting() {
		// Check if the organization is available.
		if (!this.organization) {
			return;
		}

		// Extract organization information from the current organization.
		const { id: organizationId, tenantId } = this.organization;

		// Prepare the task setting input.
		const input: IOrganizationTaskSetting = {
			...this.taskSettingForm.value,
			organizationId,
			tenantId
		};

		// Determine the service method based on the existence of organizationTaskSetting.
		const method$ = this.organizationTaskSetting
			? this._organizationTaskSettingService.update(this.organizationTaskSetting.id, input)
			: this._organizationTaskSettingService.create(input);

		// Perform the create or update operation and subscribe to the result.
		return method$.subscribe({
			next: () => {
				// You can add success logic here if needed, like displaying a success message.
			},
			error: () => {
				// Display a toastr error message if the operation fails.
				this._toastrService.error(`TOASTR.MESSAGE.ORGANIZATION_TASK_SETTINGS_UPDATE_ERROR`);
			}
		});
	}

	goBack(): void {
		if (this.organization && this.organization.id) {
			this._router.navigate([`/pages/organizations/edit/${this.organization.id}`]);
		} else {
			// Handle the case where the organization ID is not available
			console.warn('Organization ID is not available for navigation.');
		}
	}

	/**
	 * Helper function to get the default bonus based on the bonus type.
	 *
	 * @param bonusType - The type of bonus to determine the default value for.
	 * @returns The default bonus percentage based on the bonus type.
	 */
	private getDefaultBonus(bonusType: BonusTypeEnum): number {
		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				return DEFAULT_PROFIT_BASED_BONUS;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				return DEFAULT_REVENUE_BASED_BONUS;
			default:
				return 0;
		}
	}

	/**
	 * Handles changes to the bonus type and updates the bonus percentage control accordingly.
	 *
	 * @param bonusType - The selected bonus type, which determines the default bonus percentage and validation rules.
	 */
	onChangedBonusPercentage(bonusType: BonusTypeEnum): void {
		const bonusPercentageControl = this.form.get('bonusPercentage') as FormControl;

		if (bonusType) {
			const defaultBonus = this.getDefaultBonus(bonusType);
			bonusPercentageControl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
			bonusPercentageControl.setValue(this.organization.bonusPercentage || defaultBonus);
			bonusPercentageControl.enable();
		} else {
			bonusPercentageControl.setValidators(null);
			bonusPercentageControl.setValue(null);
			bonusPercentageControl.disable();
		}

		bonusPercentageControl.updateValueAndValidity();
	}

	/**
	 * Invite expire toggle switch
	 * Enabled/Disabled InviteExpiryPeriod form control
	 *
	 * @param inviteExpiry - Determines whether the invite expiry feature is enabled or disabled.
	 */
	toggleInviteExpiryPeriod(inviteExpiry: boolean): void {
		const inviteExpiryPeriodControl = this.form.get('inviteExpiryPeriod') as FormControl;
		const { inviteExpiryPeriod } = this.organization;

		if (inviteExpiry) {
			inviteExpiryPeriodControl.enable();
			inviteExpiryPeriodControl.setValidators([Validators.required, Validators.min(1)]);
		} else {
			inviteExpiryPeriodControl.disable();
			inviteExpiryPeriodControl.setValidators(null);
		}

		inviteExpiryPeriodControl.setValue(inviteExpiryPeriod || DEFAULT_INVITE_EXPIRY_PERIOD);
		inviteExpiryPeriodControl.updateValueAndValidity();
	}

	/**
	 * Tasks Proof Of Completion toggle switch
	 * Enabled/Disabled tasksProofOfCompletionType form control
	 *
	 * @param taskProofCompletion
	 * @returns
	 */
	toggleTasksProofOfCompletionType(taskProofCompletion: boolean) {
		const taskProofOfCompletionTypeControl = <FormControl>this.taskSettingForm.get('tasksProofOfCompletionType');
		const { tasksProofOfCompletionType } = this.organizationTaskSetting || {};

		if (taskProofCompletion) {
			taskProofOfCompletionTypeControl.enable();
			taskProofOfCompletionTypeControl.setValidators([Validators.required]);
		} else {
			taskProofOfCompletionTypeControl.disable();
			taskProofOfCompletionTypeControl.setValidators(null);
		}
		taskProofOfCompletionTypeControl.setValue(tasksProofOfCompletionType || DEFAULT_PROOF_COMPLETION_TYPE);
		taskProofOfCompletionTypeControl.updateValueAndValidity();
	}

	/**
	 * Task Notify Left Period toggle switch
	 * Enabled/Disabled tasksNotifyLeftPeriodDays form control
	 *
	 * @param taskNotify
	 * @returns
	 */
	toggleTasksNotifyLeftPeriodDays(taskNotify: boolean) {
		const taskNotifyPeriodControl = <FormControl>this.taskSettingForm.get('tasksNotifyLeftPeriodDays');
		const { tasksNotifyLeftPeriodDays } = this.organizationTaskSetting || {};

		if (taskNotify) {
			taskNotifyPeriodControl.enable();
			taskNotifyPeriodControl.setValidators([Validators.required, Validators.min(1)]);
		} else {
			taskNotifyPeriodControl.disable();
			taskNotifyPeriodControl.setValidators(null);
		}
		taskNotifyPeriodControl.setValue(tasksNotifyLeftPeriodDays || DEFAULT_TASK_NOTIFY_PERIOD);
		taskNotifyPeriodControl.updateValueAndValidity();
	}

	/**
	 * Tasks Auto Close toggle switch
	 * Enabled/Disabled tasksAutoClosePeriodDays form control
	 *
	 * @param taskAutoClose
	 * @returns
	 */
	toggleTasksAutoClosePeriodDays(taskAutoClose: boolean) {
		const taskAutoClosePeriodControl = <FormControl>this.taskSettingForm.get('tasksAutoClosePeriodDays');
		const { tasksAutoClosePeriodDays } = this.organizationTaskSetting || {};

		if (taskAutoClose) {
			taskAutoClosePeriodControl.enable();
			taskAutoClosePeriodControl.setValidators([Validators.required, Validators.min(1)]);
		} else {
			taskAutoClosePeriodControl.disable();
			taskAutoClosePeriodControl.setValidators(null);
		}
		taskAutoClosePeriodControl.setValue(tasksAutoClosePeriodDays || DEFAULT_AUTO_CLOSE_ISSUE_PERIOD);
		taskAutoClosePeriodControl.updateValueAndValidity();
	}

	/**
	 * Tasks Auto Archive toggle switch
	 * Enabled/Disabled tasksAutoArchivePeriodDays form control
	 *
	 * @param taskAutoArchive
	 * @returns
	 */
	toggleTasksAutoArchivePeriodDays(taskAutoArchive: boolean) {
		const taskAutoArchivePeriodControl = <FormControl>this.taskSettingForm.get('tasksAutoArchivePeriodDays');
		const { tasksAutoArchivePeriodDays } = this.organizationTaskSetting || {};

		if (taskAutoArchive) {
			taskAutoArchivePeriodControl.enable();
			taskAutoArchivePeriodControl.setValidators([Validators.required, Validators.min(1)]);
		} else {
			taskAutoArchivePeriodControl.disable();
			taskAutoArchivePeriodControl.setValidators(null);
		}
		taskAutoArchivePeriodControl.setValue(tasksAutoArchivePeriodDays || DEFAULT_AUTO_CLOSE_ISSUE_PERIOD);
		taskAutoArchivePeriodControl.updateValueAndValidity();
	}

	/**
	 * Retrieves the accounting templates for the current organization and categorizes them
	 * into invoice, estimate, and receipt templates.
	 *
	 * @returns A Promise that resolves when the templates are successfully retrieved and categorized.
	 */
	private async _getTemplates(): Promise<void> {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		const { items = [] } = await this._accountingTemplateService.getAll([], {
			languageCode: this._store.preferredLanguage,
			organizationId,
			tenantId
		});

		items.forEach((template: IAccountingTemplate) => {
			switch (template.templateType) {
				case AccountingTemplateTypeEnum.INVOICE:
					this.invoiceTemplates.push(template);
					break;
				case AccountingTemplateTypeEnum.ESTIMATE:
					this.estimateTemplates.push(template);
					break;
				case AccountingTemplateTypeEnum.RECEIPT:
					this.receiptTemplates.push(template);
					break;
				default:
					// Ignore templates that don't match predefined types
					break;
			}
		});
	}

	/**
	 * Selects a specific template based on the event (template ID) and assigns
	 * it to the correct template type (INVOICE, ESTIMATE, or RECEIPT).
	 *
	 * @param event - The ID of the template selected by the user.
	 */
	async selectTemplate(event: string): Promise<void> {
		const template = await this._accountingTemplateService.getById(event);

		// Attach organization details to the template
		template['organization'] = this.organization;
		template['organizationId'] = this.organization.id;

		// Assign the template based on its type
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
				// Handle unknown template types if needed
				break;
		}
	}

	/**
	 * Saves an updated accounting template by calling the accounting template service.
	 *
	 * @param template - The accounting template to be saved.
	 */
	async saveTemplate(template: IAccountingTemplate): Promise<void> {
		if (template) {
			await this._accountingTemplateService.updateTemplate(template.id, template);
		}
	}

	/**
	 * Sets the value of the `FormGroup`. It accepts an object that matches
	 *
	 * ### Set the complete value for the form group
	 *
	 * @returns
	 */
	private _setFormValues() {
		if (!this.organization) {
			return;
		}
		this._organizationEditStore.selectedOrganization = this.organization;
		this._setDefaultAccountingTemplates();

		this.form.patchValue({
			...this.organization, // This will patch all matching form controls
			fiscalStartDate: this.organization.fiscalStartDate, // Apply specific formatting/transformation if needed
			fiscalEndDate: this.organization.fiscalEndDate // Apply specific formatting/transformation if needed
		});
		this.form.updateValueAndValidity();

		const {
			isTasksPrivacyEnabled = false,
			isTasksMultipleAssigneesEnabled = false,
			isTasksManualTimeEnabled = false,
			isTasksGroupEstimationEnabled = false,
			isTasksEstimationInHoursEnabled = false,
			isTasksEstimationInStoryPointsEnabled = false,
			isTasksProofOfCompletionEnabled = false,
			tasksProofOfCompletionType = DEFAULT_PROOF_COMPLETION_TYPE,
			isTasksLinkedEnabled = false,
			isTasksCommentsEnabled = false,
			isTasksHistoryEnabled = false,
			isTasksAcceptanceCriteriaEnabled = false,
			isTasksDraftsEnabled = false,
			isTasksNotifyLeftEnabled = false,
			tasksNotifyLeftPeriodDays = DEFAULT_TASK_NOTIFY_PERIOD,
			isTasksAutoCloseEnabled = false,
			tasksAutoClosePeriodDays = DEFAULT_AUTO_CLOSE_ISSUE_PERIOD,
			isTasksAutoArchiveEnabled = false,
			tasksAutoArchivePeriodDays = DEFAULT_AUTO_ARCHIVE_ISSUE_PERIOD,
			isTasksAutoStatusEnabled = false
		} = this.organizationTaskSetting || {};

		this.taskSettingForm.patchValue({
			isTasksPrivacyEnabled,
			isTasksMultipleAssigneesEnabled,
			isTasksManualTimeEnabled,
			isTasksGroupEstimationEnabled,
			isTasksEstimationInHoursEnabled,
			isTasksEstimationInStoryPointsEnabled,
			isTasksProofOfCompletionEnabled,
			tasksProofOfCompletionType,
			isTasksLinkedEnabled,
			isTasksCommentsEnabled,
			isTasksHistoryEnabled,
			isTasksAcceptanceCriteriaEnabled,
			isTasksDraftsEnabled,
			isTasksNotifyLeftEnabled,
			tasksNotifyLeftPeriodDays,
			isTasksAutoCloseEnabled,
			tasksAutoClosePeriodDays,
			isTasksAutoArchiveEnabled,
			tasksAutoArchivePeriodDays,
			isTasksAutoStatusEnabled
		});

		this.taskSettingForm.updateValueAndValidity();

		/**
		 * Default selected accounting templates dropdowns
		 */
		const invoiceTemplateControl = this.form.get('invoiceTemplate') as FormControl;
		invoiceTemplateControl.setValue(this.selectedInvoiceTemplate ? this.selectedInvoiceTemplate.id : null);
		invoiceTemplateControl.updateValueAndValidity();

		const estimateTemplateControl = this.form.get('estimateTemplate') as FormControl;
		estimateTemplateControl.setValue(this.selectedEstimateTemplate ? this.selectedEstimateTemplate.id : null);
		estimateTemplateControl.updateValueAndValidity();

		const receiptTemplateControl = this.form.get('receiptTemplate') as FormControl;
		receiptTemplateControl.setValue(this.selectedReceiptTemplate ? this.selectedReceiptTemplate.id : null);
		receiptTemplateControl.updateValueAndValidity();
	}

	/**
	 * Set default organization selected accounting templates
	 *
	 * @returns
	 */
	private _setDefaultAccountingTemplates() {
		if (!this.organization || isEmpty(this.organization.accountingTemplates)) {
			return;
		}
		if (this.organization.accountingTemplates) {
			this.organization.accountingTemplates.forEach((template: IAccountingTemplate) => {
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
	}

	ngOnDestroy(): void {}
}
