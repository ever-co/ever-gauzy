import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
	NbDialogRef,
	NbStepperComponent
} from '@nebular/theme';
import { filter, first, tap } from 'rxjs/operators';
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
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import {
	CandidateSourceService,
	CandidatesService,
	ErrorHandlingService,
	RoleService,
	Store
} from '../../../@core/services';
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

	form: FormGroup;
	formCV: FormGroup;
	role: IRole;
	candidates: ICandidateCreateInput[] = [];
	organization: IOrganization;
	
	constructor(
		private readonly dialogRef: NbDialogRef<CandidateMutationComponent>,
		private readonly roleService: RoleService,
		private readonly store: Store,
		private readonly candidateSourceService: CandidateSourceService,
		private readonly candidatesService: CandidatesService,
		private readonly errorHandler: ErrorHandlingService
	) {}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization) => !!organization),
				tap((organization) => this.organization = organization),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async ngAfterViewInit() {
		this.form = this.userBasicInfo.form;
		this.formCV = this.candidateCv.form;
		
		const { tenantId } = this.store.user;
		this.role = await this.roleService
			.getRoleByName({
				name: RolesEnum.CANDIDATE,
				tenantId
			})
			.pipe(first())
			.toPromise();
	}

	closeDialog(candidate: ICandidate[] = null) {
		this.dialogRef.close(candidate);
	}

	addCandidate() {
		const user: IUser = {
			username: this.form.get('username').value,
			firstName: this.form.get('firstName').value,
			lastName: this.form.get('lastName').value,
			email: this.form.get('email').value,
			imageUrl: this.form.get('imageUrl').value,
			tenant: null,
			role: this.role,
			tags: this.userBasicInfo.selectedTags
		};
		const appliedDate = this.form.get('appliedDate').value || null;
		const rejectDate = this.form.get('rejectDate').value || null;
		const hiredDate = this.form.get('hiredDate').value || null;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const sourceName = this.form.get('source').value || null;
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

		const newCandidate: ICandidateCreateInput = {
			user,
			cvUrl,
			documents,
			password: this.form.get('password').value,
			organization: this.organization,
			appliedDate,
			hiredDate,
			source,
			rejectDate,
			tags: this.userBasicInfo.selectedTags,
			tenantId,
			organizationId
		};

		this.candidates.push(newCandidate);
		this.userBasicInfo.loadFormData();
		this.candidateCv.loadFormData();
		this.form = this.userBasicInfo.form;
		this.formCV = this.candidateCv.form;
		this.stepper.reset();
	}
	async add() {
		this.addCandidate();
		try {
			const candidates = await this.candidatesService
				.createBulk(this.candidates)
				.pipe(first())
				.toPromise();
			this.updateSource(candidates);
			this.closeDialog(candidates);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async updateSource(createdCandidates: ICandidate[]) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.candidatesService
			.getAll(['user', 'source'], {
				tenantId,
				organizationId
			})
			.pipe(first())
			.toPromise();
		const updateInput = [];
		items.forEach((item) => {
			createdCandidates.forEach((cc) => {
				if (cc.source) {
					if (item.user.id === cc.userId) {
						updateInput.push({
							candidateId: item.id,
							id: cc.source.id
						});
					}
				}
			});
		});
		if (isNotEmpty(updateInput)) {
			await this.candidateSourceService.updateBulk(updateInput);
		}
	}
}
