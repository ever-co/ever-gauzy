import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { ckEditorConfig } from '@gauzy/ui-sdk/shared';
import { ToastrService, UrlPatternValidator } from '@gauzy/ui-sdk/core';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { IProposal, ITag } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { OrganizationSettingService, ProposalsService, Store } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-proposal-edit',
	templateUrl: './proposal-edit.component.html',
	styleUrls: ['./proposal-edit.component.scss']
})
export class ProposalEditComponent extends TranslationBaseComponent implements OnInit, AfterViewInit {
	proposal: IProposal;
	ckConfig: CKEditor4.Config = ckEditorConfig;

	/*
	 * Proposal Mutation Form
	 */
	public form: UntypedFormGroup = ProposalEditComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: ProposalEditComponent): UntypedFormGroup {
		return fb.group(
			{
				jobPostUrl: [],
				valueDate: [self.organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
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
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly fb: UntypedFormBuilder,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly proposalsService: ProposalsService,
		public readonly translate: TranslateService,
		private readonly organizationSettingService: OrganizationSettingService,
		private readonly cdRef: ChangeDetectorRef
	) {
		super(translate);
	}

	ngOnInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((data) => !!data && !!data.proposal),
				tap(({ proposal }) => {
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
						this.router.navigate(['/pages/sales/proposals']);
					}
				}),
				tap(() => this._patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.cdRef.detectChanges();
	}

	/**
	 * Patches the form values based on the current proposal data.
	 *
	 * This method checks if a proposal exists and, if so, populates the form fields with
	 * the relevant data from the proposal. This can be useful for initializing or editing a form.
	 */
	private _patchFormValue(): void {
		// Check if the proposal object exists
		if (!this.proposal) {
			console.warn('No proposal found to patch the form.');
			return; // Exit early if there's no proposal
		}

		// Patch the form with values from the existing proposal
		this.form.patchValue({
			jobPostUrl: this.proposal.jobPostUrl,
			valueDate: this.proposal.valueDate,
			jobPostContent: this.proposal.jobPostContent,
			proposalContent: this.proposal.proposalContent,
			organizationContact: this.proposal.organizationContact,
			tags: this.proposal.tags,
			employee: this.proposal.employee
		});

		// Optional: Trigger form validation to ensure the form's state is consistent
		this.form.updateValueAndValidity();
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
			await this.proposalsService.update(this.proposal.id, {
				tenantId,
				organizationId,
				jobPostContent,
				jobPostUrl,
				proposalContent,
				tags,
				organizationContact
			});

			// Show success message upon successful update
			this.toastrService.success('NOTES.PROPOSALS.EDIT_PROPOSAL');

			// Navigate to the proposals page after editing
			this.router.navigate(['/pages/sales/proposals']);
		} catch (error) {
			// Handle errors that occur during the update
			this.toastrService.danger(error); // Display error message
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
