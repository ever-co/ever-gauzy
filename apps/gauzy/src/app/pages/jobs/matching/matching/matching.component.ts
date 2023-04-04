import { AfterViewInit, Component, OnInit } from '@angular/core';
import {
	IEmployeePresetInput,
	IGetJobPresetInput,
	IOrganization,
	JobPostSourceEnum,
	IJobPreset,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory,
	IJobSearchOccupation,
	IMatchingCriterions,
	JobPostTypeEnum,
	IUser,
	ITenant,
	ISelectedEmployee
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import * as _ from 'underscore';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	JobPresetService,
	JobSearchCategoryService,
	JobSearchOccupationService,
	Store,
	ToastrService
} from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-matching',
	templateUrl: './matching.component.html',
	styleUrls: ['./matching.component.scss']
})
export class MatchingComponent implements AfterViewInit, OnInit {

	criterionForm = {
		jobSource: JobPostSourceEnum.UPWORK,
		jobPresetId: null
	};
	JobPostSourceEnum = JobPostSourceEnum;
	JobPostTypeEnum = JobPostTypeEnum;
	jobPresets: IJobPreset[] = [];
	categories: IJobSearchCategory[] = [];
	occupations: IJobSearchOccupation[] = [];
	criterions: IMatchingCriterions[] = [];
	hasAnyChanges: boolean = false;
	tenantId: ITenant['id'];
	public selectedEmployeeId: ISelectedEmployee['id'];
	public organization: IOrganization;

	constructor(
		private readonly jobPresetService: JobPresetService,
		private readonly jobSearchOccupationService: JobSearchOccupationService,
		private readonly jobSearchCategoryService: JobSearchCategoryService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		this.addPreset = this.addPreset.bind(this);
		this.createNewCategories = this.createNewCategories.bind(this);
		this.createNewOccupations = this.createNewOccupations.bind(this);
	}

	ngOnInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => {
					this.getJobPresets();
					this.getCategories();
					this.getOccupations();
				}),
				untilDestroyed(this)
			)
			.subscribe();
		storeEmployee$
			.pipe(
				filter((employee) => !!employee),
				untilDestroyed(this),
				debounceTime(500)
			)
			.subscribe((employee) => {
				setTimeout(async () => {
					this.criterions = [];
					this.criterionForm = {
						jobSource: JobPostSourceEnum.UPWORK,
						jobPresetId: null
					};
					if (employee && employee.id) {
						this.jobPresetService
							.getJobPresets({ employeeId: employee.id })
							.then((jobPresets) => {
								this.criterionForm.jobPresetId =
									jobPresets.length > 0
										? jobPresets[0].id
										: null;
							});
						await this.getEmployeeCriterions();
					} else {
						this.selectedEmployeeId = null;
						this.criterions = [];
					}
					this.checkForEmptyCriterion();
				});
			});
	}

	ngAfterViewInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.tenantId = user.tenantId))
			)
			.subscribe();
	}

	/**
	 * Get Job Presets
	 *
	 * @returns
	 */
	async getJobPresets() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;

			const request: IGetJobPresetInput = {
				organizationId,
				tenantId
			};

			this.jobPresets = await this.jobPresetService.getJobPresets(request);
		} catch (error) {
			console.error('Error while retrieving job presets', error);
		}
	}

	/**
	 * Get Employee Criterions
	 *
	 * @returns
	 */
	async getEmployeeCriterions() {
		if (!this.organization) {
			return;
		}
		try {
			this.criterions = await this.jobPresetService.getEmployeeCriterions(this.selectedEmployeeId);
		} catch (error) {
			console.error('Error while retrieving employee criterions', error);
		}
	}

	/**
	 *
	 *
	 * @param name
	 */
	async addPreset(name?: IJobPreset['name']) {
		if (!this.organization) {
			return;
		}

		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;

			const jobPreset = await this.jobPresetService.createJobPreset({
				tenantId,
				organizationId,
				name,
				...(this.selectedEmployeeId
					? {
						employees: [
							{ id: this.selectedEmployeeId }
						]
					}
					: []),
			});
			this.jobPresets = this.jobPresets.concat([jobPreset]);
			this.criterionForm.jobPresetId = jobPreset.id;

			this.checkForEmptyCriterion();
		} catch (error) {
			console.error('Error while creating job presets', error);
		}
	}

	async onPresetSelected(jobPreset: IJobPreset) {
		if (jobPreset) {
			if (this.selectedEmployeeId) {
				await this.updateEmployeePreset();
			} else {
				await this.jobPresetService
					.getJobPreset(jobPreset.id)
					.then(({ jobPresetCriterions }) => {
						this.criterions = jobPresetCriterions;
					});
			}
		} else {
			this.criterions = [];
		}
		this.hasAnyChanges = false;
		this.checkForEmptyCriterion();
	}

	onSourceSelected() {
		this.criterionForm.jobPresetId = null;
		this.updateEmployeePreset();
		this.checkForEmptyCriterion();
	}

	async updateEmployeePreset() {
		this.criterions = [];
		if (this.selectedEmployeeId) {
			const request: IEmployeePresetInput = {
				source: this.criterionForm.jobSource,
				jobPresetIds: [this.criterionForm.jobPresetId],
				employeeId: this.selectedEmployeeId
			};
			await this.jobPresetService
				.saveEmployeePreset(request)
				.then((criterions) => {
					this.criterions = criterions;
				});
		}
	}

	async checkForEmptyCriterion() {
		if (
			(this.selectedEmployeeId || this.criterionForm.jobPresetId) &&
			this.criterions.length === 0
		) {
			this.addNewCriterion();
		}
	}

	saveJobPreset() {
		if (this.criterionForm.jobPresetId) {
			const request: IJobPreset = {
				id: this.criterionForm.jobPresetId
			};
			if (this.criterions && this.criterions.length > 0) {
				request.jobPresetCriterions = this.criterions.map(
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
			this.jobPresetService.createJobPreset(request).then(() => {
				this.hasAnyChanges = false;
				this.toastrService.success('TOASTR.MESSAGE.PRESET_SAVED');
			});
		}
	}

	saveCriterion(criterion?: IMatchingCriterions) {
		let req: any;
		this.hasAnyChanges = true;
		if (this.selectedEmployeeId) {
			req = this.jobPresetService.createEmployeeCriterion(
				this.selectedEmployeeId,
				criterion
			);
		} else {
			req = this.jobPresetService.createJobPresetCriterion(
				this.criterionForm.jobPresetId,
				criterion
			);
		}

		req.then((newCreation) => {
			const index = this.criterions.indexOf(criterion);
			this.criterions[index] = newCreation;
			this.toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_SAVED');
		}).catch(() => {
			this.toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
		});
	}

	async deleteCriterions(index, criterion: IMatchingCriterions) {
		if (criterion.id) {
			this.hasAnyChanges = true;
			if (this.selectedEmployeeId) {
				try {
					await this.jobPresetService.deleteEmployeeCriterion(
						this.selectedEmployeeId,
						criterion.id
					);
					this.toastrService.success(
						'TOASTR.MESSAGE.JOB_MATCHING_DELETED'
					);
				} catch (error) {
					this.toastrService.error(
						'TOASTR.MESSAGE.JOB_MATCHING_ERROR'
					);
					return;
				}
			} else {
				try {
					await this.jobPresetService.deleteJobPresetCriterion(
						criterion.id
					);
					this.toastrService.success(
						'TOASTR.MESSAGE.JOB_MATCHING_DELETED'
					);
				} catch (error) {
					this.toastrService.error(
						'TOASTR.MESSAGE.JOB_MATCHING_ERROR'
					);
					return;
				}
			}
		}

		this.criterions.splice(index, 1);
		if (this.criterions.length === 0) {
			this.addNewCriterion();
		}
	}

	/**
	 * Add new criterion
	 *
	 * @param criterion
	 */
	addNewCriterion(criterion: IMatchingCriterions = {}) {
		this.criterions.push(criterion);
	}

	/**
	 * Get Categories
	 */
	async getCategories() {
		try {
			this.categories = (
				await this.jobSearchCategoryService.getAll({
					jobSource: this.criterionForm.jobSource
				})
			).items;
		} catch (error) {
			console.error('Error while retrieving job categories', error);
		}
	}

	/**
	 * Get Occupations
	 */
	async getOccupations() {
		try {
			this.occupations = (
				await this.jobSearchOccupationService.getAll({
					jobSource: this.criterionForm.jobSource
				})
			).items;
		} catch (error) {
			console.error('Error while retrieving job occupations', error);
		}
	}

	/**
	 * Create new job search category
	 *
	 * @param name
	 * @returns
	 */
	async createNewCategories(name: IJobSearchCategory['name']) {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;
			const { jobSource } = this.criterionForm;

			const category = await this.jobSearchCategoryService.create({
				name,
				tenantId,
				organizationId,
				jobSource
			});
			this.categories = this.categories.concat([category]);
		} catch (error) {
			console.error('Error while creating new job search category', error);
		}
	}

	/**
	 * Create new job search occupation
	 *
	 * @param name
	 * @returns
	 */
	async createNewOccupations(name: IJobSearchOccupation['name']) {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;
			const { jobSource } = this.criterionForm;

			const occupation = await this.jobSearchOccupationService.create({
				name,
				tenantId,
				organizationId,
				jobSource
			});
			this.occupations = this.occupations.concat([occupation]);
		} catch (error) {
			console.error('Error while creating new job search occupation', error);
		}
	}
}
