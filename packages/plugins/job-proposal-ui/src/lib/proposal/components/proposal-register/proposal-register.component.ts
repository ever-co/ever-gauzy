import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { NbDateService } from '@nebular/theme';
import * as moment from 'moment';
import {
	ITag,
	IOrganization,
	IEmployee,
	IEmployeeProposalTemplate,
	IOrganizationContact,
	ISelectedEmployee,
	ID
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	ErrorHandlingService,
	OrganizationSettingService,
	ProposalsService,
	Store,
	ToastrService,
	UrlPatternValidator
} from '@gauzy/ui-core/core';
import { ckEditorConfig } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-proposal-register',
    templateUrl: './proposal-register.component.html',
    styleUrls: ['././proposal-register.component.scss'],
    standalone: false
})
export class ProposalRegisterComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	proposalTemplate: IEmployeeProposalTemplate;
	proposalTemplateId: ID;
	organization: IOrganization;
	ckConfig: CKEditor4.Config = ckEditorConfig;
	selectedEmployee: IEmployee;
	minDate: Date;

	/*
	 * Payment Mutation Form
	 */
	public form: UntypedFormGroup = ProposalRegisterComponent.buildForm(this._fb, this);
	static buildForm(fb: UntypedFormBuilder, self: ProposalRegisterComponent): UntypedFormGroup {
		return fb.group(
			{
				jobPostUrl: [],
				valueDate: [self._organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
				jobPostContent: ['', Validators.required],
				proposalContent: ['', Validators.required],
				tags: [],
				organizationContact: [],
				employee: []
			},
			{
				validators: [UrlPatternValidator.websiteUrlValidator('jobPostUrl')]
			}
		);
	}

	constructor(
		readonly translateService: TranslateService,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _router: Router,
		private readonly _dateService: NbDateService<Date>,
		private readonly _proposalsService: ProposalsService,
		private readonly _toastrService: ToastrService,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _organizationSettingService: OrganizationSettingService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.minDate = this._dateService.addMonth(this._dateService.today(), 0);
	}

	ngOnInit(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._cdRef.detectChanges();
	}

	/**
	 * Select Employee Selector
	 *
	 * @param employee
	 */
	selectionEmployee(employee: ISelectedEmployee) {
		if (employee) {
			this.form.patchValue({ employee: employee });
			this.form.updateValueAndValidity();
		}
		this.proposalTemplateId = null;
	}

	/**
	 * Updates the 'proposalContent' field in the form based on a given template.
	 *
	 * @param item An `IEmployeeProposalTemplate` object. If `null` or empty, the 'proposalContent' field is set to `null`.
	 */
	onProposalTemplateChange(item: IEmployeeProposalTemplate | null): void {
		// Check if the provided item is not empty
		if (isNotEmpty(item)) {
			// Set 'proposalContent' field in the form with the content from the item
			this.form.patchValue({ proposalContent: item.content });
		} else {
			// If item is empty or null, clear 'proposalContent' field
			this.form.patchValue({ proposalContent: null });
		}
		// Ensure the form updates its state after patching values
		this.form.updateValueAndValidity();
	}

	/**
	 * Registers a new proposal based on the form input, validating required conditions.
	 *
	 * If the form is valid and an organization is set, it extracts relevant data from the form,
	 * creates a proposal via the proposalsService, and navigates to the appropriate page.
	 *
	 * Displays success or error messages based on the operation's outcome.
	 *
	 * @returns A promise that resolves when the proposal is registered or rejects with an error.
	 */
	public async registerProposal() {
		// Return early if organization is not set or form is invalid
		if (!this.organization || this.form.invalid) {
			return;
		}

		const {
			jobPostUrl,
			valueDate,
			jobPostContent,
			proposalContent,
			organizationContact,
			tags = [],
			employee
		} = this.form.value; // Extract form values

		if (!employee) {
			// No employee selected, show a specific message
			this._toastrService.success(
				'NOTES.PROPOSALS.REGISTER_PROPOSAL_NO_EMPLOYEE_SELECTED',
				null,
				'TOASTR.MESSAGE.REGISTER_PROPOSAL_NO_EMPLOYEE_MSG'
			);
			return; // Exit early if no employee is selected
		}

		try {
			const { id: organizationId, tenantId } = this.organization; // Extract current tenant ID & organization ID

			// Create the new proposal with the collected data
			await this._proposalsService.create({
				organizationId,
				tenantId,
				jobPostUrl,
				valueDate: moment(valueDate).startOf('day').toDate(), // Start of day to avoid time discrepancies
				jobPostContent,
				proposalContent,
				employee: { id: employee.id },
				employeeId: employee.id,
				organizationContact: { id: organizationContact.id },
				organizationContactId: organizationContact.id,
				tags
			});

			// Show success message and navigate to the sales/proposals page with query params
			this._toastrService.success('NOTES.PROPOSALS.REGISTER_PROPOSAL');

			// Navigate to the proposals page with query params
			this._router.navigate(['/pages/sales/proposals'], {
				queryParams: { date: moment(valueDate).format('MM-DD-YYYY') }
			});
		} catch (error) {
			// Handle error cases, show an appropriate message
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Sets the 'organizationContact' field on the form with the given value.
	 *
	 * @param organizationContact The selected organization contact to be set in the form.
	 */
	selectOrganizationContact(contact: IOrganizationContact) {
		this.form.get('organizationContact').setValue(contact);
		this.form.get('organizationContact').updateValueAndValidity();
	}

	/**
	 * Sets the 'tags' field on the form with the given list of tags.
	 *
	 * @param tags An array of selected tags to be set in the form.
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	ngOnDestroy(): void {}
}
