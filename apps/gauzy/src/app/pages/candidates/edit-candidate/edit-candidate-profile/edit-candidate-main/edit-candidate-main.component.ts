import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { IOrganization, ICandidate, IImageAsset } from '@gauzy/contracts';
import { CandidateStore, ToastrService } from '@gauzy/ui-core/core';
import { Store, distinctUntilChange } from '@gauzy/ui-core/common';

/**
 * This component contains the properties stored within the User Entity of an candidate.
 * Any property which is either stored directly in the candidate entity or as a relation of the candidate entity should NOT be put in this Component
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-main',
	templateUrl: './edit-candidate-main.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	],
	styles: [
		`
			:host {
				overflow-y: auto;
				max-height: calc(100vh - 24rem);
				height: 100%;
			}
		`
	]
})
export class EditCandidateMainComponent implements OnInit, OnDestroy {
	hoverState: boolean;
	selectedCandidate: ICandidate;
	organization: IOrganization;

	/*
	 * Candidate Main Mutation Form
	 */
	public form: UntypedFormGroup = this._fb.group({
		username: [],
		email: ['', Validators.required],
		firstName: ['', Validators.required],
		lastName: [],
		imageUrl: [{ value: null, disabled: true }],
		imageId: []
	});

	constructor(
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _candidateStore: CandidateStore
	) {}

	ngOnInit() {
		const storeOrganization$ = this._store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization),
			distinctUntilChange(),
			tap((organization: IOrganization) => {
				this.organization = organization;
			})
		);
		const storeCandidate$ = this._candidateStore.selectedCandidate$.pipe(
			filter((candidate: ICandidate) => !!candidate),
			distinctUntilChange(),
			tap((candidate: ICandidate) => {
				this.selectedCandidate = candidate;
			})
		);
		combineLatest([storeOrganization$, storeCandidate$])
			.pipe(
				tap(() => this._initializeFormValue(this.selectedCandidate)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles form submission and updates the candidate store with the form value.
	 */
	async onSubmit() {
		try {
			if (this.form.valid) {
				// Update user form data in store (assuming updateUserForm is async)
				await this._candidateStore.updateUserForm(this.form.value);
			}
		} catch (error) {
			this.handleSubmissionError(error);
		}
	}

	/**
	 * Initializes form values with the given candidate data.
	 *
	 * @param candidate - The candidate data to initialize the form with.
	 */
	private _initializeFormValue(candidate: ICandidate) {
		const { username, email, firstName, lastName, imageUrl, imageId } = candidate?.user || {};
		this.form.patchValue({ username, email, firstName, lastName, imageUrl, imageId });
	}

	/**
	 * Upload candidate image/avatar
	 *
	 * @param image - The image asset to update.
	 */
	async updateImageAsset(image: IImageAsset) {
		if (image) {
			try {
				await this._candidateStore.updateUserForm({ imageId: image.id });
			} catch (error) {
				console.error('Error while updating candidate avatar:', error);
				this.handleImageUploadError(error);
			}
		}
	}

	/**
	 * Handles errors during form submission.
	 *
	 * @param error - The error object to handle.
	 */
	private handleSubmissionError(error: any) {
		// Optional: Implement error handling logic (e.g., show error message)
		console.error('Form submission error:', error);
		this._toastrService.danger(error);
	}

	/**
	 * Handle errors during image upload.
	 *
	 * @param error - The error object to handle.
	 */
	handleImageUploadError(error: any) {
		this._toastrService.danger('Error uploading image: ' + (error.message || error));
	}

	ngOnDestroy(): void {}
}
