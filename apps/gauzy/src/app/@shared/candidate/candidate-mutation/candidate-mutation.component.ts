import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { NbDialogRef, NbStepperComponent, NbTagComponent } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	RolesEnum,
	IUser,
	IRole,
	ICandidateCreateInput,
	ICandidate,
	ICandidateDocument,
	ICandidateSource,
	IOrganization
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ErrorHandlingService } from '@gauzy/ui-sdk/core';
import { CandidatesService, RoleService, Store } from '../../../@core/services';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import { CandidateCvComponent } from '../candidate-cv/candidate-cv.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-candidate-mutation',
	templateUrl: 'candidate-mutation.component.html',
	styleUrls: ['candidate-mutation.component.scss']
})
export class CandidateMutationComponent implements OnInit, AfterViewInit {
	@ViewChild('userBasicInfo')
	userBasicInfo: BasicInfoFormComponent;

	@ViewChild('candidateCv')
	candidateCv: CandidateCvComponent;

	@ViewChild('stepper')
	stepper: NbStepperComponent;

	form: UntypedFormGroup;
	formCV: UntypedFormGroup;
	role: IRole;
	candidates: ICandidateCreateInput[] = [];
	organization: IOrganization;

	constructor(
		private readonly dialogRef: NbDialogRef<CandidateMutationComponent>,
		private readonly roleService: RoleService,
		private readonly store: Store,
		private readonly candidatesService: CandidatesService,
		private readonly errorHandler: ErrorHandlingService
	) {}

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

	async ngAfterViewInit() {
		this.form = this.userBasicInfo.form;
		this.formCV = this.candidateCv.form;

		const { tenantId } = this.store.user;
		this.role = await firstValueFrom(
			this.roleService.getRoleByOptions({
				name: RolesEnum.CANDIDATE,
				tenantId
			})
		);
	}

	closeDialog(candidate: ICandidate[] = null) {
		this.dialogRef.close(candidate);
	}

	addCandidate() {
		this.form = this.userBasicInfo.form;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { firstName, lastName, email, username, password, tags, imageUrl } = this.form.getRawValue();
		const { appliedDate = null, rejectDate = null } = this.form.getRawValue();
		const sourceName = this.form.get('source').value || null;

		const user: IUser = {
			username,
			firstName,
			lastName,
			email,
			imageUrl,
			tenant: null,
			role: this.role,
			tags
		};

		let source: ICandidateSource = null;
		if (sourceName !== null) {
			source = {
				name: sourceName,
				tenantId,
				organizationId
			};
		}

		const cvUrl = this.formCV.get('cvUrl').value || null;
		let documents: ICandidateDocument[] = null;
		if (cvUrl !== null) {
			documents = [
				{
					name: 'CV',
					documentUrl: cvUrl,
					tenantId,
					organizationId
				}
			];
		}

		const candidate: ICandidateCreateInput = {
			user,
			cvUrl,
			documents,
			password,
			organization: this.organization,
			appliedDate,
			source,
			rejectDate,
			tags,
			tenantId,
			organizationId
		};

		if (this.form.valid) this.candidates.push(candidate);
		this.candidateCv.loadFormData();
		this.formCV = this.candidateCv.form;

		this.form.reset();
		this.stepper.reset();
	}

	async add() {
		this.addCandidate();
		try {
			const candidates = await firstValueFrom(this.candidatesService.createBulk(this.candidates));
			this.closeDialog(candidates);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	/**
	 *  Go to another the step without to saving data form
	 */
	gotoStep(step: number) {
		for (let i = 1; i < step; i++) {
			this.stepper.next(); // change step
		}
	}

	/**
	 * Removed one candidate in the array of candidates.
	 * @param tag
	 */
	onCandidateRemove(tag: NbTagComponent): void {
		this.candidates = this.candidates.filter((t: ICandidateCreateInput) => t.user.email !== tag.text);
	}
}
