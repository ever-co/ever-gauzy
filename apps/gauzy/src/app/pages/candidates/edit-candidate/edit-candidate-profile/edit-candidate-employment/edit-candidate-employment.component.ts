import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Params } from '@angular/router';
import {
	Organization,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPositions,
	Tag,
	Candidate
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
	selectedCandidate: Candidate;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employmentTypes: OrganizationEmploymentType[];
	selectedOrganization: Organization;
	departments: OrganizationDepartment[] = [];
	positions: OrganizationPositions[] = [];
	tags: Tag[] = [];
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
			organizationId: this.selectedCandidate.orgId
		});
		this.departments = items;
	}

	private getPositions() {
		this.organizationPositionsService
			.getAll({ organizationId: this.selectedOrganization.id })
			.then((data) => {
				const { items } = data;
				this.positions = items;
			});
	}

	private getEmploymentTypes() {
		this.organizationEmploymentTypeService
			.getAll([], {
				organizationId: this.selectedOrganization.id
			})
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

	selectedTagsHandler(tags: Tag[]) {
		this.tags = tags;
	}

	private _initializeForm(candidate: Candidate) {
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

		this.tags = candidate.tags;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
