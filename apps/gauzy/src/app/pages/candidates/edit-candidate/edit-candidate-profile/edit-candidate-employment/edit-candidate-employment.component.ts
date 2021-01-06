import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
	IOrganization,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	ITag,
	ICandidate,
	IEmployeeLevel
} from '@gauzy/models';
import { OrganizationDepartmentsService } from '../../../../../@core/services/organization-departments.service';
import { OrganizationEmploymentTypesService } from '../../../../../@core/services/organization-employment-types.service';
import { OrganizationPositionsService } from '../../../../../@core/services/organization-positions';
import { Store } from '../../../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
import { CandidateStore } from '../../../../../@core/services/candidate-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeLevelService } from '../../../../../@core/services/employee-level.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-candidate-employment',
	templateUrl: './edit-candidate-employment.component.html',
	styleUrls: ['./edit-candidate-employment.component.scss']
})
export class EditCandidateEmploymentComponent implements OnInit, OnDestroy {
	form: FormGroup;
	selectedCandidate: ICandidate;
	employmentTypes: IOrganizationEmploymentType[];
	selectedOrganization: IOrganization;
	departments: IOrganizationDepartment[] = [];
	positions: IOrganizationPosition[] = [];
	candidateLevels: IEmployeeLevel[] = [];
	tags: ITag[] = [];
	selectedTags: any;
	organizationId: string;
	tenantId: string;

	constructor(
		private readonly fb: FormBuilder,
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
				filter((candidate) => !!candidate),
				untilDestroyed(this)
			)
			.subscribe((candidate) => {
				this.selectedCandidate = candidate;
				this._initializeForm(this.selectedCandidate);
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organizationId = organization.id)),
				tap(() => (this.tenantId = this.store.user.tenantId)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				this._initMethods();
			});
	}

	private _initMethods() {
		this.getPositions();
		this.getEmploymentTypes();
		this.getDepartments();
		this.getEmployeeLevel();
	}

	private async getEmployeeLevel() {
		const { organizationId, tenantId } = this;
		const { items = [] } = await this.employeeLevelService.getAll(
			organizationId,
			[],
			{
				tenantId
			}
		);
		this.candidateLevels = items;
	}

	private async getDepartments() {
		const { organizationId, tenantId } = this;
		const { items } = await this.organizationDepartmentsService.getAll([], {
			organizationId,
			tenantId
		});
		this.departments = items;
	}

	private getPositions() {
		const { organizationId, tenantId } = this;
		this.organizationPositionsService
			.getAll({ organizationId, tenantId })
			.then((data) => {
				const { items } = data;
				this.positions = items;
			});
	}

	private getEmploymentTypes() {
		const { organizationId, tenantId } = this;
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

	async submitForm() {
		if (this.form.valid) {
			this.candidateStore.candidateForm = {
				...this.form.value
			};
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	private _initializeForm(candidate: ICandidate) {
		const candidateLevel: any = candidate.candidateLevel;

		this.form = this.fb.group({
			organizationEmploymentTypes: [
				candidate.organizationEmploymentTypes || null
			],
			candidateLevel: [candidateLevel || null],
			organizationDepartments: [
				candidate.organizationDepartments || null
			],
			organizationPosition: [candidate.organizationPosition || null],
			tags: [candidate.tags]
		});

		this.tags = this.form.get('tags').value || [];
	}

	ngOnDestroy() {}
}
