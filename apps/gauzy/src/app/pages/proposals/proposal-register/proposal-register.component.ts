import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { NbDateService } from '@nebular/theme';
import * as moment from 'moment';
import { UrlPatternValidator } from '@gauzy/ui-sdk/core';
import { ckEditorConfig } from '@gauzy/ui-sdk/shared';
import {
	ITag,
	IOrganization,
	IEmployee,
	IEmployeeProposalTemplate,
	IOrganizationContact,
	ISelectedEmployee
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ProposalsService, Store, ToastrService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-register',
	templateUrl: './proposal-register.component.html',
	styleUrls: ['././proposal-register.component.scss']
})
export class ProposalRegisterComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	proposalTemplate: IEmployeeProposalTemplate;
	proposalTemplateId: IEmployeeProposalTemplate['id'];
	organization: IOrganization;
	ckConfig: CKEditor4.Config = ckEditorConfig;
	minDate: Date;
	selectedEmployee: IEmployee;

	/*
	 * Payment Mutation Form
	 */
	public form: UntypedFormGroup = ProposalRegisterComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: ProposalRegisterComponent): UntypedFormGroup {
		return fb.group(
			{
				jobPostUrl: [],
				valueDate: [self.store.getDateFromOrganizationSettings(), Validators.required],
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
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private readonly cdRef: ChangeDetectorRef,
		private readonly dateService: NbDateService<Date>
	) {
		super(translateService);
		this.minDate = this.dateService.addMonth(this.dateService.today(), 0);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
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
			this.toastrService.success(
				'NOTES.PROPOSALS.REGISTER_PROPOSAL_NO_EMPLOYEE_SELECTED',
				null,
				'TOASTR.MESSAGE.REGISTER_PROPOSAL_NO_EMPLOYEE_MSG'
			);
			return; // Exit early if no employee is selected
		}

		try {
			const { id: organizationId, tenantId } = this.organization; // Extract current tenant ID & organization ID

			// Create the new proposal with the collected data
			await this.proposalsService.create({
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
			this.toastrService.success('NOTES.PROPOSALS.REGISTER_PROPOSAL');
			this.router.navigate(['/pages/sales/proposals'], {
				queryParams: {
					date: moment(valueDate).format('MM-DD-YYYY')
				}
			});
		} catch (error) {
			// Handle error cases, show an appropriate message
			this.toastrService.danger(error);
		}
	}

	/**
	 * Sets the 'organizationContact' field on the form with the given value.
	 *
	 * @param organizationContact The selected organization contact to be set in the form.
	 */
	selectOrganizationContact(organizationContact: IOrganizationContact) {
		this.form.get('organizationContact').setValue(organizationContact);
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
