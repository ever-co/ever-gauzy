import { Component, OnInit } from '@angular/core';
import {
	GetJobPresetCriterionInput,
	GetJobPresetInput,
	JobPostSourceEnum,
	JobPreset,
	JobPresetUpworkJobSearchCriterion,
	MatchingCriterions
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { JobPresetService } from 'apps/gauzy/src/app/@core/services/job-preset.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { SelectedEmployee } from 'apps/gauzy/src/app/@theme/components/header/selectors/employee/employee.component';
import { debounceTime } from 'rxjs/operators';
import * as _ from 'underscore';

@UntilDestroy()
@Component({
	selector: 'gauzy-matching',
	templateUrl: './matching.component.html',
	styleUrls: ['./matching.component.scss']
})
export class MatchingComponent implements OnInit {
	jobPresets: JobPreset[];
	criterionForm = {
		jobSource: JobPostSourceEnum.UPWORK,
		jobPresetId: null
	};
	JobPostSourceEnum = JobPostSourceEnum;
	categories: string[] = [];
	occupations: string[] = [];
	criterions: MatchingCriterions[] = [];
	jobPreset: JobPreset;
	selectedEmployee: SelectedEmployee;

	constructor(
		private jobPresetService: JobPresetService,
		private toastrService: ToastrService,
		private store: Store
	) {
		this.addPreset = this.addPreset.bind(this);
	}

	ngOnInit(): void {
		this.getJobPresets();

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.pipe(debounceTime(500))
			.subscribe((employee) => {
				setTimeout(async () => {
					this.selectedEmployee = employee;
					this.updateCriterions();
				});
			});
	}

	getJobPresets() {
		const request: GetJobPresetInput = {};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			request.employeeId = this.selectedEmployee.id;
		}
		this.jobPresetService.getJobPresets(request).then((jobPresets) => {
			this.jobPresets = jobPresets;
		});
	}

	addPreset(name?: string) {
		const request: JobPreset = {
			name
		};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			request.employees = [{ id: this.selectedEmployee.id }];
		}
		this.jobPresetService.createJobPreset(request).then((jobPreset) => {
			this.jobPresets = this.jobPresets.concat([jobPreset]);
		});
	}

	async onPresetSelected(jobPreset: JobPreset) {
		this.jobPreset = jobPreset;
		this.updateCriterions();
	}

	async updateCriterions() {
		try {
			if (this.jobPreset) {
				const id = this.jobPreset.id;
				const request: GetJobPresetCriterionInput = {};
				if (this.selectedEmployee && this.selectedEmployee.id) {
					request.employeeId = this.selectedEmployee.id;
				}
				await this.jobPresetService
					.getJobPreset(id, request)
					.then((jobPresets) => {
						this.jobPreset = jobPresets;
						return jobPresets;
					});

				if (this.selectedEmployee && this.selectedEmployee.id) {
					this.criterions =
						this.jobPreset.employeeCriterion.length > 0
							? this.jobPreset.employeeCriterion
							: this.jobPreset.jobPresetCriterion;
				} else {
					this.criterions = this.jobPreset.jobPresetCriterion;
				}
			}
		} catch (error) {
			this.criterions = [];
		}

		if (this.criterions.length === 0) {
			this.addNewCriterion();
		}
	}

	addNewCriterion(criterion: MatchingCriterions = {}) {
		this.criterions.push(criterion);
	}

	saveJobPreset(criterion?: MatchingCriterions) {
		const request: JobPreset = _.omit(this.jobPreset, 'employeeCriterion');
		request.jobPresetCriterion = this.jobPreset.employeeCriterion.map(
			(employeeCriterion): JobPresetUpworkJobSearchCriterion => {
				return _.omit(employeeCriterion, 'employeeId', 'id');
			}
		);
		this.jobPresetService.createJobPreset(request).then((jobPreset) => {
			this.jobPresets = this.jobPresets.concat([jobPreset]);
		});

		this.criterions.push(criterion);
	}

	saveCriterion(criterion?: MatchingCriterions) {
		if (this.selectedEmployee && this.selectedEmployee.id) {
			criterion.employeeId = this.selectedEmployee.id;
		}
		this.jobPresetService
			.createJobPresetCriterion(this.jobPreset.id, criterion)
			.then((newCreation) => {
				console.log({ newCreation });
				const index = this.criterions.indexOf(criterion);
				this.criterions[index] = newCreation;
				this.toastrService.success('Criterion successfully saved');
			})
			.catch(() => {
				this.toastrService.error(
					'Error while saving criterion, Please try aging'
				);
			});
	}

	deleteCriterions(index, criterion: MatchingCriterions) {
		this.jobPresetService
			.deleteJobPresetCriterion(criterion.id)
			.then(() => {
				this.criterions.splice(index, 1);
				if (this.criterions.length === 0) {
					this.addNewCriterion();
				}
				this.toastrService.success('Criterion successfully saved');
			})
			.catch(() => {
				this.toastrService.error(
					'Error while saving criterion, Please try aging'
				);
			});
	}

	createNewCategories(title) {
		this.categories.push(title);
	}

	createNewOccupations(title) {
		this.occupations.push(title);
	}
}
