import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { catchError, map, Observable, of, switchMap, tap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IPipeline, IContact, IOrganization, IDeal, IPagination } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DealsService,
	ErrorHandlingService,
	OrganizationContactService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './pipeline-deal-form.component.html',
	selector: 'ga-pipeline-deals-form',
	styleUrls: ['./pipeline-deal-form.component.scss']
})
export class PipelineDealFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public selectedClient: IContact;
	public probabilities = [0, 1, 2, 3, 4, 5];
	public selectedProbability: number;
	public organization: IOrganization;
	public deal: IDeal;
	public deal$: Observable<IDeal>;
	public pipeline: IPipeline;
	public pipeline$: Observable<IPipeline>;
	public clients: IContact[] = [];
	public clients$: Observable<IContact[]>;

	// Form Builder
	public form: UntypedFormGroup = PipelineDealFormComponent.buildForm(this._fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			stageId: [null, Validators.required],
			title: [null, Validators.required],
			clientId: [null],
			probability: [null, Validators.required]
		});
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _dealsService: DealsService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _clientsService: OrganizationContactService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		// Setting up the organization$ observable pipeline
		this.clients$ = this._store.selectedOrganization$.pipe(
			// Ensure only distinct values are emitted
			distinctUntilChange(),
			// Exclude falsy values from the emitted values
			filter((organization: IOrganization) => !!organization),
			// Tap operator for side effects - setting the organization property
			tap((organization: IOrganization) => (this.organization = organization)),
			// Switch to route data stream once organization is confirmed
			switchMap(() => {
				// Extract organization properties
				const { id: organizationId, tenantId } = this.organization;
				// Fetch contacts
				return this._clientsService.getAll([], {
					organizationId,
					tenantId
				});
			}),
			// Map the contacts to the clients property
			map(({ items }: IPagination<IContact>) => items),
			// Handle errors
			catchError((error) => {
				console.error('Error fetching organization contacts:', error);
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.pipeline$ = this._activatedRoute.params.pipe(
			// Filter for the presence of pipelineId in route params
			filter(({ pipelineId }) => !!pipelineId),
			// Switch to route data stream once pipelineId is confirmed
			switchMap(() => this._activatedRoute.data),
			// Exclude falsy values from the emitted values
			filter(({ pipeline }: Data) => !!pipeline),
			// Map the pipeline to the pipeline property
			map(({ pipeline }: Data) => pipeline),
			// Tap operator for side effects - setting the form property
			tap((pipeline: IPipeline) => {
				this.pipeline = pipeline;
				this.form.patchValue({ stageId: this.pipeline.stages[0]?.id });
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.deal$ = this._activatedRoute.params.pipe(
			// Filter for the presence of dealId in route params
			filter(({ dealId }) => !!dealId),
			// Switch to route data stream once dealId is confirmed
			switchMap(() => this._activatedRoute.data),
			// Exclude falsy values from the emitted values
			filter(({ deal }: Data) => !!deal),
			// Map the deal to the deal property
			map(({ deal }: Data) => deal),
			// Tap operator for side effects - setting the form property
			tap((deal: IDeal) => {
				this.deal = deal;
				this.patchFormValue(deal);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Patch form values with the deal data
	 *
	 * @param deal The deal object containing data to patch into the form
	 */
	patchFormValue(deal: IDeal) {
		const { title, stageId, createdBy, probability, clientId } = deal;
		this.form.patchValue({
			title,
			stageId,
			createdBy,
			probability,
			clientId
		});
		this.selectedProbability = probability;
	}

	/**
	 * Submits the form data for creating or updating a deal.
	 *
	 * This method handles the submission of form data for either creating a new deal
	 * or updating an existing one. It also manages form state (disable/enable) and
	 * displays success notifications.
	 *
	 * @returns {Promise<void>} A promise that resolves when the form submission is complete.
	 */
	public async onSubmit(): Promise<void> {
		const { organization, form } = this;

		// If no organization is selected, do not proceed
		if (!organization) {
			return;
		}

		// Extract organizationId and tenantId from the selected organization
		const { id: organizationId, tenantId } = organization;

		// Merge the form values with organizationId and tenantId
		const value = { ...form.value, organizationId, tenantId };

		// Disable the form to prevent further input during submission
		form.disable();

		try {
			// Determine whether to create a new deal or update an existing one
			if (this.deal) {
				await this._dealsService.update(this.deal?.id, value);
			} else {
				await this._dealsService.create(value);
			}

			// Determine the success message based on whether it's a create or update operation
			const successMessage = this.deal?.id ? 'PIPELINE_DEALS_PAGE.DEAL_EDITED' : 'PIPELINE_DEALS_PAGE.DEAL_ADDED';

			// Display a success notification with the deal title
			this._toastrService.success(successMessage, { name: value.title });

			// Navigate to the appropriate route after successful submission
			this._router.navigate([this.deal?.id ? '../..' : '..'], { relativeTo: this._activatedRoute });
		} catch (error) {
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		} finally {
			// If an error occurs, re-enable the form for further input
			form.enable();
		}
	}

	/**
	 * Cancels the form submission.
	 */
	cancel() {
		window.history.back();
	}

	ngOnDestroy() {}
}
