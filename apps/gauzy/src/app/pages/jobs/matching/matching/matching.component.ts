import { Component, OnInit } from '@angular/core';
import {
	IEmployeePresetInput,
	IGetJobPresetCriterionInput,
	IGetJobPresetInput,
	IOrganization,
	JobPostSourceEnum,
	IJobPreset,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory,
	IJobSearchOccupation,
	IMatchingCriterions,
	IEmployee,
	JobPostTypeEnum
} from '@gauzy/models';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { JobPresetService } from 'apps/gauzy/src/app/@core/services/job-preset.service';
import { JobSearchCategoryService } from 'apps/gauzy/src/app/@core/services/job-search-category.service';
import { JobSearchOccupationService } from 'apps/gauzy/src/app/@core/services/job-search-occupation.service';
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
	jobPresets: IJobPreset[];
	criterionForm = {
		jobSource: JobPostSourceEnum.UPWORK,
		jobPresetId: null
	};
	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	categories: IJobSearchCategory[] = [];
	occupations: IJobSearchOccupation[] = [];
	criterions: IMatchingCriterions[] = [];
	jobPreset: IJobPreset;
	selectedEmployee: SelectedEmployee;
	selectedOrganization: IOrganization;

	constructor(
		private jobPresetService: JobPresetService,
		private jobSearchOccupationService: JobSearchOccupationService,
		private jobSearchCategoryService: JobSearchCategoryService,
		private toastrService: ToastrService,
		private store: Store
	) {
		this.addPreset = this.addPreset.bind(this);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.pipe(debounceTime(500))
			.subscribe((organization) => {
				setTimeout(async () => {
					this.selectedOrganization = organization;
					if (this.selectedOrganization) {
						this.getJobPresets();
						this.getCategories();
						this.getOccupations();
					}
				});
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.pipe(debounceTime(500))
			.subscribe((employee) => {
				setTimeout(async () => {
					this.selectedEmployee = employee;
					if (this.selectedEmployee && this.selectedEmployee.id) {
						const preset = await this.getEmployeePreset();
						this.criterionForm = {
							jobSource: JobPostSourceEnum.UPWORK,
							jobPresetId: preset ? preset.id : null
						};
					} else {
						this.criterionForm = {
							jobSource: JobPostSourceEnum.UPWORK,
							jobPresetId: null
						};
					}
					this.updateCriterionsData();
				});
			});

		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.pipe(debounceTime(500))
			.subscribe((employee) => {
				setTimeout(async () => {
					this.selectedEmployee = employee;
					if (this.selectedEmployee && this.selectedEmployee.id) {
						const preset = await this.getEmployeePreset();
						this.criterionForm = {
							jobSource: JobPostSourceEnum.UPWORK,
							jobPresetId: preset ? preset.id : null
						};
					} else {
						this.criterionForm = {
							jobSource: JobPostSourceEnum.UPWORK,
							jobPresetId: null
						};
					}
					this.updateCriterionsData();
				});
			});
	}

	getJobPresets() {
		const request: IGetJobPresetInput = {
			organizationId: this.selectedOrganization.id
		};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			request.employeeId = this.selectedEmployee.id;
		}
		this.jobPresetService.getJobPresets(request).then((jobPresets) => {
			this.jobPresets = jobPresets;
		});
	}

	getEmployeePreset() {
		return this.jobPresetService
			.getEmployeePresets(this.selectedEmployee.id)
			.then((jobPresets) => {
				if (jobPresets.length > 0) {
					this.jobPreset = jobPresets[0];
				} else {
					this.jobPreset = null;
				}
				return this.jobPreset;
			});
	}

	addPreset(name?: string) {
		const request: IJobPreset = {
			organizationId: this.selectedOrganization.id,
			name
		};
		if (this.selectedEmployee && this.selectedEmployee.id) {
			request.employees = [{ id: this.selectedEmployee.id }];
		}
		this.jobPresetService.createJobPreset(request).then((jobPreset) => {
			this.jobPresets = this.jobPresets.concat([jobPreset]);
		});
	}

	async onPresetSelected(jobPreset: IJobPreset) {
		this.jobPreset = jobPreset;
		this.updateEmployeePreset();
		await this.updateCriterionsData();
	}

	onSourceSelected() {
		this.updateEmployeePreset();
	}

	updateEmployeePreset() {
		if (this.selectedEmployee && this.selectedEmployee.id) {
			const request: IEmployeePresetInput = {
				source: this.criterionForm.jobSource,
				jobPresetIds: [this.criterionForm.jobPresetId],
				employeeId: this.selectedEmployee.id
			};
			this.jobPresetService.saveEmployeePreset(request);
		}
	}

	async updateCriterionsData() {
		try {
			if (this.jobPreset) {
				const id = this.jobPreset.id;
				const request: IGetJobPresetCriterionInput = {};
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
						this.jobPreset.employeeCriterions.length > 0
							? this.jobPreset.employeeCriterions
							: this.jobPreset.jobPresetCriterions;
				} else {
					this.criterions = this.jobPreset.jobPresetCriterions;
				}
			} else {
				this.criterions = [];
			}
		} catch (error) {
			this.criterions = [];
		}

		if (this.criterions.length === 0) {
			this.addNewCriterion();
		}
	}

	addNewCriterion(criterion: IMatchingCriterions = {}) {
		this.criterions.push(criterion);
	}

	saveJobPreset() {
		if (this.jobPreset) {
			const request: IJobPreset = _.omit(
				this.jobPreset,
				'employeeCriterion'
			);
			if (
				this.jobPreset.employeeCriterions &&
				this.jobPreset.employeeCriterions.length > 0
			) {
				request.jobPresetCriterions = this.jobPreset.employeeCriterions.map(
					(employeeCriterion): IJobPresetUpworkJobSearchCriterion => {
						return _.omit(
							employeeCriterion,
							'employeeId',
							'id',
							'jobPresetId'
						);
					}
				);
				request.jobPresetCriterions = request.jobPresetCriterions.filter(
					(employeeCriterion) => {
						const values = Object.values(employeeCriterion);
						return values.length > 0;
					}
				);
			}
			this.jobPresetService.createJobPreset(request).then((jobPreset) => {
				this.jobPresets = this.jobPresets.map((oldJobPreset) => {
					if (oldJobPreset.id === jobPreset.id) {
						return jobPreset;
					} else {
						return oldJobPreset;
					}
				});
			});
		}
	}

	saveCriterion(criterion?: IMatchingCriterions) {
		if (this.selectedEmployee && this.selectedEmployee.id) {
			criterion.employeeId = this.selectedEmployee.id;
		}
		this.jobPresetService
			.createJobPresetCriterion(this.jobPreset.id, criterion)
			.then((newCreation) => {
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

	deleteCriterions(index, criterion: IMatchingCriterions) {
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

	getCategories() {
		this.jobSearchCategoryService
			.getAll({
				jobSource: this.criterionForm.jobSource
			})
			.then((categories) => {
				this.categories = categories.items;
			});
	}

	getOccupations() {
		this.jobSearchOccupationService
			.getAll({
				jobSource: this.criterionForm.jobSource
			})
			.then((occupations) => {
				this.occupations = occupations.items;
			});
	}

	createNewCategories = (title) => {
		this.jobSearchCategoryService
			.create({
				name: title,
				organizationId: this.selectedOrganization.id,
				jobSource: this.criterionForm.jobSource
			})
			.then((category) => {
				this.categories = this.categories.concat([category]);
				console.log(this.categories);
			});
	};

	createNewOccupations = (title) => {
		this.jobSearchOccupationService
			.create({
				name: title,
				organizationId: this.selectedOrganization.id,
				jobSource: this.criterionForm.jobSource
			})
			.then((occupation) => {
				this.occupations = this.occupations.concat([occupation]);
			});
	};
}
