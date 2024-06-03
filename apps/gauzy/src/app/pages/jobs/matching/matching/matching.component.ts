import { AfterViewInit, Component, OnInit } from '@angular/core';
import {
	IEmployeePresetInput,
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
	ISelectedEmployee,
	IGetJobPresetInput
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, combineLatest, map, switchMap, of as observableOf, BehaviorSubject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import * as _ from 'underscore';
import { Store, distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-sdk/common';
import { ToastrService } from '@gauzy/ui-sdk/core';
import { JobPresetService, JobSearchCategoryService, JobSearchOccupationService } from './../../../../@core/services';

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
	public hasAddPreset$: Observable<boolean>;
	public tenantId: ITenant['id'];
	public selectedEmployeeId: ISelectedEmployee['id'];
	public organization: IOrganization;
	private payloads$: BehaviorSubject<object | null> = new BehaviorSubject(null);

	constructor(
		private readonly jobPresetService: JobPresetService,
		private readonly jobSearchOccupationService: JobSearchOccupationService,
		private readonly jobSearchCategoryService: JobSearchCategoryService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {}

	ngOnInit(): void {
		this.hasAddPreset$ = this.store.selectedEmployee$.pipe(
			map((employee: ISelectedEmployee) => !(!!employee && !!employee.id))
		);
		this.payloads$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((payloads: IGetJobPresetInput) => !!payloads),
				tap(() => this.getJobPresets()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				switchMap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
					return observableOf(employee);
				}),
				tap(() => this.preparePayloads()),
				filter((employee: ISelectedEmployee) => !!employee),
				tap(() => this.getEmployeeCriterions()),
				untilDestroyed(this)
			)
			.subscribe();
		storeOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(() => this.getCategories()),
				tap(() => this.getOccupations()),
				untilDestroyed(this)
			)
			.subscribe();
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
	 * Prepare Unique Payloads
	 *
	 * @returns
	 */
	preparePayloads() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const request: IGetJobPresetInput = {
			tenantId,
			organizationId,
			...(this.selectedEmployeeId
				? {
						employeeId: this.selectedEmployeeId
				  }
				: {})
		};
		this.payloads$.next(request);
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
			const payloads: IGetJobPresetInput = this.payloads$.getValue();
			const jobPresets = await this.jobPresetService.getJobPresets(payloads);
			this.jobPresets = jobPresets;

			if (this.selectedEmployeeId) {
				this.criterionForm.jobPresetId = jobPresets.length > 0 ? jobPresets[0].id : null;
			}
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
			this.criterions = [];
			if (this.selectedEmployeeId) {
				this.criterions = await this.jobPresetService.getEmployeeCriterions(this.selectedEmployeeId);

				if (isEmpty(this.criterions)) {
					this.addNewCriterion();
				}
			}
		} catch (error) {
			console.error('Error while retrieving employee criterions', error);
		}
	}

	/**
	 * Add new preset from here
	 *
	 * @param name
	 */
	addPreset = async (name: IJobPreset['name']) => {
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
							employees: [{ id: this.selectedEmployeeId }]
					  }
					: [])
			});
			this.jobPresets = this.jobPresets.concat([jobPreset]);
			this.criterionForm.jobPresetId = jobPreset.id;

			this.criterions = [];
			this.addNewCriterion();
		} catch (error) {
			console.error('Error while creating job presets', error);
		}
	};

	async onPresetSelected(jobPreset: IJobPreset) {
		try {
			this.criterions = [];
			if (jobPreset) {
				if (this.selectedEmployeeId) {
					await this.updateEmployeePreset();
				} else {
					const { jobPresetCriterions = [] } = await this.jobPresetService.getJobPreset(jobPreset.id);
					if (isNotEmpty(jobPresetCriterions)) {
						this.criterions = jobPresetCriterions;
					} else {
						this.addNewCriterion();
					}
				}
			}
			this.hasAnyChanges = false;
		} catch (error) {
			console.log('Error while change job preset', error);
		}
	}

	onSourceSelected() {
		this.criterionForm.jobPresetId = null;
		this.updateEmployeePreset();
	}

	async updateEmployeePreset() {
		this.criterions = [];
		if (this.selectedEmployeeId) {
			const request: IEmployeePresetInput = {
				source: this.criterionForm.jobSource,
				jobPresetIds: [this.criterionForm.jobPresetId],
				employeeId: this.selectedEmployeeId
			};
			await this.jobPresetService.saveEmployeePreset(request).then((criterions) => {
				this.criterions = criterions;
			});
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
						return _.omit(employeeCriterion, 'employeeId', 'id', 'jobPresetId');
					}
				);
				request.jobPresetCriterions = request.jobPresetCriterions.filter((employeeCriterion) => {
					const values = Object.values(employeeCriterion);
					return values.length > 0;
				});
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
			req = this.jobPresetService.createEmployeeCriterion(this.selectedEmployeeId, criterion);
		} else {
			req = this.jobPresetService.createJobPresetCriterion(this.criterionForm.jobPresetId, criterion);
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
					await this.jobPresetService.deleteEmployeeCriterion(this.selectedEmployeeId, criterion.id);
					this.toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_DELETED');
				} catch (error) {
					this.toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
					return;
				}
			} else {
				try {
					await this.jobPresetService.deleteJobPresetCriterion(criterion.id);
					this.toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_DELETED');
				} catch (error) {
					this.toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
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
	addNewCriterion(
		criterion: IMatchingCriterions = {
			jobType: JobPostTypeEnum.HOURLY
		}
	) {
		this.criterions.push(criterion);
	}

	/**
	 * Get Categories
	 */
	async getCategories() {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;
			const { jobSource } = this.criterionForm;

			this.categories = (
				await this.jobSearchCategoryService.getAll({
					tenantId,
					organizationId,
					jobSource
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
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this;
			const { id: organizationId } = this.organization;
			const { jobSource } = this.criterionForm;

			this.occupations = (
				await this.jobSearchOccupationService.getAll({
					tenantId,
					organizationId,
					jobSource
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
	createNewCategories = async (name: IJobSearchCategory['name']) => {
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
	};

	/**
	 * Create new job search occupation
	 *
	 * @param name
	 * @returns
	 */
	createNewOccupations = async (name: IJobSearchOccupation['name']) => {
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
	};
}
