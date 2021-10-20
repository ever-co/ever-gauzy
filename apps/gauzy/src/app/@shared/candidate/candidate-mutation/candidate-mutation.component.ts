import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
	NbDialogRef,
	NbStepperComponent
} from '@nebular/theme';
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
		this.role = await firstValueFrom(
			this.roleService.getRoleByName({
				name: RolesEnum.CANDIDATE,
				tenantId
			})
		);
	}

	closeDialog(candidate: ICandidate[] = null) {
		this.dialogRef.close(candidate);
	}

	addCandidate() {
		const {
			username,
			firstName,
			lastName,
			email,
			imageUrl,
			tags,
			password
		} = this.form.getRawValue();
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
			password,
			organization: this.organization,
			appliedDate,
			hiredDate,
			source,
			rejectDate,
			tags,
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
			const candidates = await firstValueFrom(
				this.candidatesService.createBulk(this.candidates)
			);
			this.updateSource(candidates);
			this.closeDialog(candidates);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async updateSource(createdCandidates: ICandidate[]) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		
		const { items = [] } = await firstValueFrom(
			this.candidatesService.getAll(['user', 'source'], {
				tenantId,
				organizationId
			})
		);

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
