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
	Candidate
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { RoleService } from '../../../@core/services/role.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'ga-candidate-mutation',
	templateUrl: 'candidate-mutation.component.html',
	styleUrls: ['candidate-mutation.component.scss']
})
export class CandidateMutationComponent implements OnInit, AfterViewInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;
	@ViewChild('stepper', { static: false })
	stepper: NbStepperComponent;
	form: FormGroup;
	role: Role;
	candidates: CandidateCreateInput[] = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateMutationComponent>,
		protected organizationsService: OrganizationsService,
		private readonly roleService: RoleService,
		protected toastrService: NbToastrService,
		protected store: Store
	) {}

	ngOnInit(): void {}

	async ngAfterViewInit() {
		this.form = this.userBasicInfo.form;
		this.role = await this.roleService
			.getRoleByName({
				name: RolesEnum.CANDIDATE
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

		const rejectDate = this.form.get('rejectDate').value || null;

		const newCandidate: CandidateCreateInput = {
			user,
			password: this.form.get('password').value,
			organization: this.store.selectedOrganization,

			rejectDate
			// tags: this.userBasicInfo.selectedTags
		};
		this.candidates.push(newCandidate);
		this.userBasicInfo.loadFormData();
		this.form = this.userBasicInfo.form;
		this.stepper.reset();
	}
}
