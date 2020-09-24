import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Params } from '@angular/router';
import {
	IOrganization,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	ITag,
	ICandidate
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEmploymentTypesService } from 'apps/gauzy/src/app/@core/services/organization-employment-types.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

@Component({
	selector: 'ga-edit-candidate-employment',
	templateUrl: './edit-candidate-employment.component.html',
	styleUrls: ['./edit-candidate-employment.component.scss']
})
export class EditCandidateEmploymentComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedCandidate: ICandidate;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employmentTypes: IOrganizationEmploymentType[];
	selectedOrganization: IOrganization;
	departments: IOrganizationDepartment[] = [];
	positions: IOrganizationPosition[] = [];
	tags: ITag[] = [];
	selectedTags: any;

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly candidateStore: CandidateStore,
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypesService
	) {}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (candidate) => {
				this.selectedCandidate = candidate;

				if (this.selectedCandidate) {
					this.getDepartments();
					this._initializeForm(this.selectedCandidate);
				}

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
						if (this.selectedOrganization) {
							this.getPositions();
							this.getEmploymentTypes();
						}
					});
			});
	}

	private async getDepartments() {
		const { items } = await this.organizationDepartmentsService.getAll([], {
			organizationId: this.selectedCandidate.organizationId
		});
		this.departments = items;
	}

	private getPositions() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.organizationPositionsService
			.getAll({ organizationId, tenantId })
			.then((data) => {
				const { items } = data;
				this.positions = items;
			});
	}

	private getEmploymentTypes() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.organizationEmploymentTypeService
			.getAll([], { organizationId, tenantId })
			.pipe(takeUntil(this._ngDestroy$))
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
		this.form = this.fb.group({
			organizationEmploymentTypes: [
				candidate.organizationEmploymentTypes || null
			],
			candidateLevel: [candidate.candidateLevel || null],
			organizationDepartments: [
				candidate.organizationDepartments || null
			],
			organizationPosition: [candidate.organizationPosition || null],
			tags: [candidate.tags]
		});

		this.tags = this.form.get('tags').value || [];
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
