import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import {
	IOrganization,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	ITag,
	ICandidate,
	IEmployeeLevel
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	CandidateStore,
	EmployeeLevelService,
	OrganizationDepartmentsService,
	OrganizationEmploymentTypesService,
	OrganizationPositionsService,
	Store
} from '../../../../../@core/services';
import { ToastrService } from '@gauzy/ui-sdk/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-employment',
	templateUrl: './edit-candidate-employment.component.html',
	styleUrls: ['./edit-candidate-employment.component.scss']
})
export class EditCandidateEmploymentComponent implements OnInit, OnDestroy {
	selectedCandidate: ICandidate;
	employmentTypes: IOrganizationEmploymentType[] = [];
	organization: IOrganization;
	departments: IOrganizationDepartment[] = [];
	positions: IOrganizationPosition[] = [];
	candidateLevels: IEmployeeLevel[] = [];
	selectedTags: any;

	/*
	 * Edit Candidate Employment Mutation Form
	 */
	public form: UntypedFormGroup = EditCandidateEmploymentComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			organizationEmploymentTypes: [],
			candidateLevel: [],
			organizationDepartments: [],
			organizationPosition: [],
			tags: []
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly candidateStore: CandidateStore,
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypesService,
		private readonly employeeLevelService: EmployeeLevelService
	) {}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(
				filter((candidate: ICandidate) => !!candidate),
				tap((candidate: ICandidate) => (this.selectedCandidate = candidate)),
				tap((candidate: ICandidate) => this._syncEmployment(candidate)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._initMethods()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _initMethods() {
		this.getPositions();
		this.getEmploymentTypes();
		this.getDepartments();
		this.getEmployeeLevel();
	}

	private async getEmployeeLevel() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const { items = [] } = await this.employeeLevelService.getAll([], {
			tenantId,
			organizationId
		});
		this.candidateLevels = items;
	}

	private async getDepartments() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { items } = await this.organizationDepartmentsService.getAll([], {
			organizationId,
			tenantId
		});
		this.departments = items;
	}

	private getPositions() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.organizationPositionsService.getAll({ organizationId, tenantId }).then((data) => {
			const { items } = data;
			this.positions = items;
		});
	}

	private getEmploymentTypes() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		this.organizationEmploymentTypeService
			.getAll([], { organizationId, tenantId })
			.pipe(untilDestroyed(this))
			.subscribe((types) => {
				this.employmentTypes = types.items;
			});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	submitForm() {
		if (this.form.valid) {
			this.candidateStore.candidateForm = {
				...this.form.getRawValue()
			};
		}
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	private _syncEmployment(candidate: ICandidate) {
		this.form.patchValue({
			organizationEmploymentTypes: candidate.organizationEmploymentTypes || null,
			candidateLevel: candidate.candidateLevel || null,
			organizationDepartments: candidate.organizationDepartments || null,
			organizationPosition: candidate.organizationPosition || null,
			tags: candidate.tags || []
		});
	}

	ngOnDestroy() {}
}
