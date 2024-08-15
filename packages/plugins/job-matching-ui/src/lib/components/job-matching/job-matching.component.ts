import { Component, OnInit } from '@angular/core';
import { Observable, combineLatest, map, BehaviorSubject, merge } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { omit } from 'underscore';
import {
	IOrganization,
	JobPostSourceEnum,
	IJobPreset,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory,
	IJobSearchOccupation,
	IMatchingCriterions,
	JobPostTypeEnum,
	ISelectedEmployee,
	IGetJobPresetInput,
	ID,
	LanguagesEnum
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	JobPresetService,
	JobSearchCategoryService,
	JobSearchOccupationService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { I18nService, TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-matching',
	templateUrl: './job-matching.component.html',
	styleUrls: ['./job-matching.component.scss']
})
export class JobMatchingComponent extends TranslationBaseComponent implements OnInit {
	public criterionForm = {
		jobSource: JobPostSourceEnum.UPWORK,
		jobPresetId: null
	};
	public JobPostSourceEnum = JobPostSourceEnum;
	public JobPostTypeEnum = JobPostTypeEnum;
	public jobPresets: IJobPreset[] = [];
	public categories: IJobSearchCategory[] = [];
	public occupations: IJobSearchOccupation[] = [];
	public criterions: IMatchingCriterions[] = [];
	public hasAnyChanges: boolean = false;
	public hasAddPreset$: Observable<boolean> = this._store.selectedEmployee$.pipe(
		map((employee: ISelectedEmployee) => !(!!employee && !!employee.id))
	);
	public selectedEmployeeId: ID;
	public organization: IOrganization;
	private payloads$: BehaviorSubject<object | null> = new BehaviorSubject(null);

	constructor(
		readonly translateService: TranslateService,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _store: Store,
		private readonly _i18nService: I18nService,
		private readonly _jobPresetService: JobPresetService,
		private readonly _jobSearchOccupationService: JobSearchOccupationService,
		private readonly _jobSearchCategoryService: JobSearchCategoryService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Initialize UI permissions
		this.initializeUiPermissions();
		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();

		this.payloads$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((payloads: IGetJobPresetInput) => !!payloads),
				tap(() => this.getJobPresets()),
				untilDestroyed(this)
			)
			.subscribe();

		// Get Organization
		const storeOrganization$ = this._store.selectedOrganization$.pipe(
			distinctUntilChange(),
			filter((organization: IOrganization) => !!organization),
			tap((organization: IOrganization) => (this.organization = organization)),
			tap(() => {
				this.getCategories();
				this.getOccupations();
			}),
			untilDestroyed(this)
		);

		// Get Employee
		const storeEmployee$ = this._store.selectedEmployee$.pipe(
			distinctUntilChange(),
			filter((employee: ISelectedEmployee) => !!employee),
			tap((employee: ISelectedEmployee) => (this.selectedEmployeeId = employee.id)),
			tap(() => this.getEmployeeCriterions()),
			untilDestroyed(this)
		);

		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				tap(() => this.preparePayloads()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initialize UI permissions
	 */
	private initializeUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
			untilDestroyed(this)
		);

		// Subscribe to preferred language changes
		preferredLanguage$.subscribe((preferredLanguage: string | LanguagesEnum) => {
			this.translateService.use(preferredLanguage);
		});
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

		// Get Organization
		const { id: organizationId, tenantId } = this.organization;

		// Prepare Payloads
		const request: IGetJobPresetInput = {
			tenantId,
			organizationId,
			...(this.selectedEmployeeId ? { employeeId: this.selectedEmployeeId } : {})
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
			const jobPresets = await this._jobPresetService.getJobPresets(payloads);
			this.jobPresets = jobPresets;

			if (this.selectedEmployeeId) {
				this.criterionForm.jobPresetId = jobPresets.length > 0 ? jobPresets[0].id : null;
			}
		} catch (error) {
			console.error('Error while retrieving job presets', error);
			this._errorHandlingService.handleError(error);
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
				this.criterions = await this._jobPresetService.getEmployeeCriterions(this.selectedEmployeeId);

				if (isEmpty(this.criterions)) {
					this.addNewCriterion();
				}
			}
		} catch (error) {
			console.error('Error while retrieving employee criterions', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Add new preset from here
	 *
	 * @param name
	 */
	addPreset = async (name: string) => {
		if (!this.organization) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;
			const jobPreset = await this._jobPresetService.createJobPreset({
				name,
				tenantId,
				organizationId,
				...(this.selectedEmployeeId ? { employees: [{ id: this.selectedEmployeeId }] } : [])
			});
			this.jobPresets = this.jobPresets.concat([jobPreset]);
			this.criterionForm.jobPresetId = jobPreset.id;

			this.criterions = [];
			this.addNewCriterion();
		} catch (error) {
			console.error('Error while creating job presets', error);
			this._errorHandlingService.handleError(error);
		}
	};

	async onPresetSelected(jobPreset: IJobPreset) {
		try {
			this.criterions = [];
			if (jobPreset) {
				if (this.selectedEmployeeId) {
					await this.updateEmployeePreset();
				} else {
					const { jobPresetCriterions = [] } = await this._jobPresetService.getJobPreset(jobPreset.id);
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
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * On Source Selected
	 *
	 * @returns
	 */
	onSourceSelected() {
		this.criterionForm.jobPresetId = null;
		this.updateEmployeePreset();
	}

	/**
	 * Update Employee Preset
	 *
	 * @returns
	 */
	async updateEmployeePreset() {
		if (!this.organization || !this.selectedEmployeeId) {
			return;
		}

		try {
			// Get Organization
			const { id: organizationId, tenantId } = this.organization;
			const { jobSource, jobPresetId } = this.criterionForm;

			// Update Employee Preset
			this.criterions = await this._jobPresetService.saveEmployeePreset({
				source: jobSource,
				jobPresetIds: [jobPresetId],
				employeeId: this.selectedEmployeeId,
				tenantId,
				organizationId
			});
		} catch (error) {
			console.error('Error while updating employee preset', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Save Job Preset
	 *
	 * @returns
	 */
	async saveJobPreset() {
		if (!this.organization || !this.criterionForm.jobPresetId) {
			return;
		}

		// Get Organization
		const { id: organizationId, tenantId } = this.organization;
		const { jobPresetId } = this.criterionForm;

		// Create job preset
		const request: IJobPreset = {
			id: jobPresetId,
			tenantId,
			organizationId
		};

		// Update criterions
		if (this.criterions && this.criterions.length > 0) {
			request.jobPresetCriterions = this.criterions
				.map((item): IJobPresetUpworkJobSearchCriterion => omit(item, 'employeeId', 'id', 'jobPresetId'))
				.filter((criterion) => Object.values(criterion).length > 0);
		}

		// Create job preset
		const jobPreset = await this._jobPresetService.createJobPreset(request);

		// Update criterions
		if (jobPreset) {
			this.hasAnyChanges = false;
			this._toastrService.success('TOASTR.MESSAGE.PRESET_SAVED');
		}
	}

	/**
	 * Save Criterion
	 *
	 * @param criterion
	 */
	async saveCriterion(criterion?: IMatchingCriterions) {
		if (!this.organization) {
			return;
		}

		// Get Organization
		const { id: organizationId, tenantId } = this.organization;

		let createdCriterion: IMatchingCriterions;
		this.hasAnyChanges = true;

		try {
			if (this.selectedEmployeeId) {
				createdCriterion = await this._jobPresetService.createEmployeeCriterion(this.selectedEmployeeId, {
					...criterion,
					tenantId,
					organizationId
				});
			} else {
				createdCriterion = await this._jobPresetService.createJobPresetCriterion(
					this.criterionForm.jobPresetId,
					{
						...criterion,
						tenantId,
						organizationId
					}
				);
			}

			const index = this.criterions.indexOf(criterion);
			this.criterions[index] = createdCriterion;
			this._toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_SAVED');
		} catch (error) {
			this._toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
		}
	}

	/**
	 * Delete criterion
	 *
	 * @param index
	 * @param criterion
	 * @returns
	 */
	async deleteCriterions(index: number, criterion: IMatchingCriterions) {
		if (criterion.id) {
			this.hasAnyChanges = true;
			if (this.selectedEmployeeId) {
				try {
					await this._jobPresetService.deleteEmployeeCriterion(this.selectedEmployeeId, criterion.id);
					this._toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_DELETED');
				} catch (error) {
					this._toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
					return;
				}
			} else {
				try {
					await this._jobPresetService.deleteJobPresetCriterion(criterion.id);
					this._toastrService.success('TOASTR.MESSAGE.JOB_MATCHING_DELETED');
				} catch (error) {
					this._toastrService.error('TOASTR.MESSAGE.JOB_MATCHING_ERROR');
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
			const { id: organizationId, tenantId } = this.organization;
			const { jobSource } = this.criterionForm;

			// Get Categories
			const categories = await this._jobSearchCategoryService.getAll({
				tenantId,
				organizationId,
				jobSource
			});

			// Set Categories
			this.categories = categories.items;
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
			const { id: organizationId, tenantId } = this.organization;
			const { jobSource } = this.criterionForm;

			// Get Occupations
			const occupations = await this._jobSearchOccupationService.getAll({
				tenantId,
				organizationId,
				jobSource
			});

			// Set Occupations
			this.occupations = occupations.items;
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
			const { id: organizationId, tenantId } = this.organization;
			const { jobSource } = this.criterionForm;

			const category = await this._jobSearchCategoryService.create({
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
			const { id: organizationId, tenantId } = this.organization;
			const { jobSource } = this.criterionForm;

			const occupation = await this._jobSearchOccupationService.create({
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
