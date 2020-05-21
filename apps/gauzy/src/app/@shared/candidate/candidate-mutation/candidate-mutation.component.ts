import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import {
	NbDialogRef,
	NbToastrService,
	NbStepperComponent
} from '@nebular/theme';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import {
	RolesEnum,
	User,
	Role,
	CandidateCreateInput,
	Candidate,
	ICandidateDocument
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { RoleService } from '../../../@core/services/role.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { CandidateCvComponent } from '../candidate-cv/candidate-cv.component';

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
	role: Role;
	candidates: CandidateCreateInput[] = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateMutationComponent>,
		protected organizationsService: OrganizationsService,
		private readonly roleService: RoleService,
		protected toastrService: NbToastrService,
		protected store: Store,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService
	) {}

	ngOnInit(): void {}

	async ngAfterViewInit() {
		this.form = this.userBasicInfo.form;
		this.formCV = this.candidateCv.form;
		this.role = await this.roleService
			.getRoleByName({
				name: RolesEnum.CANDIDATE,
				tenant: this.store.user.tenant
			})
			.pipe(first())
			.toPromise();
	}

	closeDialog(candidate: Candidate[] = null) {
		this.dialogRef.close(candidate);
	}

	addCandidate() {
		const user: User = {
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
		const cvUrl = this.formCV.get('cvUrl').value || null;
		let documents: ICandidateDocument[] = null;
		if (cvUrl !== null) {
			documents = [{ name: 'CV', documentUrl: cvUrl }];
		}

		const newCandidate: CandidateCreateInput = {
			user,
			cvUrl,
			documents,
			password: this.form.get('password').value,
			organization: this.store.selectedOrganization,
			appliedDate,
			hiredDate,
			rejectDate,
			tags: this.userBasicInfo.selectedTags
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
			const candidate = await this.candidatesService
				.createBulk(this.candidates)
				.pipe(first())
				.toPromise();
			this.closeDialog(candidate);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
}
