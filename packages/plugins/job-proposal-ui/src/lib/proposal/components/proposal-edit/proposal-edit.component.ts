import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { IProposal, ITag } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	OrganizationSettingService,
	ProposalsService,
	ToastrService,
	UrlPatternValidator
} from '@gauzy/ui-core/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ckEditorConfig } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-proposal-edit',
    templateUrl: './proposal-edit.component.html',
    styleUrls: ['./proposal-edit.component.scss'],
    standalone: false
})
export class ProposalEditComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	public proposal: IProposal;
	public ckConfig: CKEditor4.Config = ckEditorConfig;

	/*
	 * Proposal Mutation Form
	 */
	public form: UntypedFormGroup = ProposalEditComponent.buildForm(this._fb, this);
	static buildForm(fb: UntypedFormBuilder, self: ProposalEditComponent): UntypedFormGroup {
		return fb.group(
			{
				jobPostUrl: [],
				valueDate: [self._organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
				jobPostContent: [null, Validators.required],
				proposalContent: [null, Validators.required],
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
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _fb: UntypedFormBuilder,
		private readonly _router: Router,
		private readonly _toastrService: ToastrService,
		private readonly _proposalsService: ProposalsService,
		private readonly _organizationSettingService: OrganizationSettingService,
		private readonly _cdRef: ChangeDetectorRef,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._route.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data) => !!data && !!data.proposal),
				tap(({ proposal }) => this.selectProposal(proposal)),
				tap(() => this._patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._cdRef.detectChanges();
	}

	/**
	 * Selects the proposal and sets the form values.
	 *
	 * @param proposal
	 */
	selectProposal(proposal: IProposal): void {
		try {
			this.proposal = Object.assign({}, proposal, {
				jobPostLink: proposal.jobPostUrl ? proposal.jobPostUrl : '',
				jobTitle: proposal.jobPostContent
					.toString()
					.replace(/<[^>]*(>|$)|&nbsp;/g, '')
					.split(/[\s,\n]+/)
					.slice(0, 3)
					.join(' '),
				author: proposal.employee
			});
		} catch (error) {
			console.log('Error while selecting proposal', error);
			this._router.navigate(['/pages/sales/proposals']);
		}
	}

	/**
	 * Patches the form with values from the current proposal, if available.
	 *
	 * This method populates the form fields with data from the existing proposal,
	 * which is useful for initializing or editing a form.
	 */
	private _patchFormValue(): void {
		if (!this.proposal) {
			console.warn('No proposal found to patch the form.');
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
		} = this.proposal;

		this.form.patchValue({
			jobPostUrl,
			valueDate,
			jobPostContent,
			proposalContent,
			organizationContact,
			tags,
			employee
		});

		this.form.updateValueAndValidity(); // Ensure the form's state is consistent
	}

	/**
	 * Edits an existing proposal if the form is valid and a proposal is specified.
	 *
	 * This function updates a proposal based on the form's input values. It validates the form,
	 * extracts necessary information, and uses the `proposalsService` to perform the update.
	 * Success or error messages are displayed based on the outcome.
	 *
	 * @returns A promise that resolves upon successful editing or rejects with an error.
	 */
	async editProposal(): Promise<void> {
		// Check if the form is valid and the proposal exists
		if (!this.form.valid || !this.proposal) {
			return; // Return early if preconditions are not met
		}

		try {
			const { organizationId, tenantId } = this.proposal; // Extract the tenant ID & organization ID from the existing proposal

			// Get the necessary data from the form
			const { jobPostContent, jobPostUrl, proposalContent, tags, organizationContact } = this.form.value;

			// Update the proposal with new values
			await this._proposalsService.update(this.proposal.id, {
				tenantId,
				organizationId,
				jobPostContent,
				jobPostUrl,
				proposalContent,
				tags,
				organizationContact
			});

			// Show success message upon successful update
			this._toastrService.success('NOTES.PROPOSALS.EDIT_PROPOSAL');

			// Navigate to the proposals page after editing
			this._router.navigate(['/pages/sales/proposals']);
		} catch (error) {
			console.log('Error while editing proposal', error);
			// Handle errors that occur during the update
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Updates the 'tags' field in the form based on the selected tags.
	 *
	 * @param tags An array of selected tags to be set in the form.
	 */
	selectedTagsEvent(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}
}
