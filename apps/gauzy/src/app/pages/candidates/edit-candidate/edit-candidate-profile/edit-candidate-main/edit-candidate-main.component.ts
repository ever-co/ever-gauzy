import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IOrganization, ICandidate, IImageAsset } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';
import { CandidateStore } from '@gauzy/ui-core/core';

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
	public form: UntypedFormGroup = EditCandidateMainComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			username: [],
			email: [null, Validators.required],
			firstName: [],
			lastName: [],
			imageUrl: [{ value: null, disabled: true }],
			imageId: []
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly candidateStore: CandidateStore
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.candidateStore.selectedCandidate$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				filter(([organization, candidate]) => !!organization && !!candidate),
				tap(([organization, candidate]) => {
					this.organization = organization;
					this.selectedCandidate = candidate;
				}),
				tap(() => this._initializeFormValue(this.selectedCandidate)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async submitForm() {
		if (this.form.valid) {
			this.candidateStore.userForm = {
				...this.form.value
			};
		}
	}

	/**
	 * Candidate initialize form value
	 *
	 * @param candidate
	 */
	private _initializeFormValue(candidate: ICandidate) {
		this.form.patchValue({
			username: candidate?.user?.username,
			email: candidate?.user?.email,
			firstName: candidate?.user?.firstName,
			lastName: candidate?.user?.lastName,
			imageUrl: candidate?.user?.imageUrl,
			imageId: candidate?.user?.imageId
		});
	}

	/**
	 * Upload candidate image/avatar
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image) {
				this.candidateStore.userForm = {
					imageId: image.id
				};
			}
		} catch (error) {
			console.log('Error while updating candidate avatars');
			this.handleImageUploadError(error);
		}
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	ngOnDestroy(): void {}
}
