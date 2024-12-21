import { AfterViewInit, Component, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BehaviorSubject, combineLatest, debounceTime, filter, firstValueFrom, map, Subject, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization, IPagination, ITaskStatus, ITaskStatusFindInput, TaskStatusEnum } from '@gauzy/contracts';
import { distinctUntilChange, sluggable } from '@gauzy/ui-core/common';
import { ErrorHandlingService, Store, TaskStatusesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-task-status-select',
    templateUrl: './task-status-select.component.html',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => TaskStatusSelectComponent),
            multi: true
        }
    ],
    standalone: false
})
export class TaskStatusSelectComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public organization: IOrganization;
	private subject$: Subject<boolean> = new Subject();

	/**
	 * A BehaviorSubject to store and emit the latest list of task statuses.
	 */
	public statuses$: BehaviorSubject<ITaskStatus[]> = new BehaviorSubject([]);

	/**
	 * Predefined task statuses with names and sluggable values.
	 */
	private _statuses: Array<{ name: string; value: string }> = [
		{ name: TaskStatusEnum.OPEN, value: sluggable(TaskStatusEnum.OPEN) },
		{ name: TaskStatusEnum.IN_PROGRESS, value: sluggable(TaskStatusEnum.IN_PROGRESS) },
		{ name: TaskStatusEnum.READY_FOR_REVIEW, value: sluggable(TaskStatusEnum.READY_FOR_REVIEW) },
		{ name: TaskStatusEnum.IN_REVIEW, value: sluggable(TaskStatusEnum.IN_REVIEW) },
		{ name: TaskStatusEnum.BLOCKED, value: sluggable(TaskStatusEnum.BLOCKED) },
		{ name: TaskStatusEnum.COMPLETED, value: sluggable(TaskStatusEnum.COMPLETED) }
	];

	/**
	 * Input properties for component customization.
	 *
	 * @property addTag - Whether adding new tags is allowed (default: true).
	 */
	@Input() addTag: boolean = true;

	/**
	 * The placeholder text to be displayed in the project selector.
	 * Provides guidance to the user on what action to take or what information to provide.
	 *
	 */
	@Input() placeholder: string | null = null;

	/**
	 * Enables the default selection behavior.
	 * When `true`, the component may automatically select a default team upon initialization.
	 *
	 * @default true
	 */
	@Input() defaultSelected: boolean = true;

	/*
	 * Getter and Setter for the selected organization project ID.
	 * The setter updates the private _projectId and notifies any observers of the change.
	 */
	private _projectId: ID;
	@Input() set projectId(value: ID) {
		this._projectId = value;
		this.subject$.next(true); // Notify subscribers that the project ID has changed
	}

	get projectId(): ID {
		return this._projectId;
	}

	/*
	 * Getter & Setter for status
	 */
	private _status: ITaskStatus;
	get status(): ITaskStatus {
		return this._status;
	}
	set status(val: ITaskStatus) {
		this._status = val;
		this.onChange(val); // Notify form control value change
		this.onTouched(); // Mark as touched in form control
	}

	/**
	 * Callback function to notify changes in the form control.
	 */
	private onChange: (value: ITaskStatus) => void = () => {};

	/**
	 * Callback function to notify touch events in the form control.
	 */
	private onTouched: () => void = () => {};

	/**
	 * EventEmitter to notify when a status is selected or changed.
	 */
	@Output() onChanged = new EventEmitter<ITaskStatus>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly _store: Store,
		private readonly _taskStatusesService: TaskStatusesService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getStatuses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeProject$ = this._store.selectedProject$;
		combineLatest([storeOrganization$, storeProject$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, project]) => {
					this.organization = organization;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates the status value for the component.
	 *
	 * @param value - The task status to be written to the component.
	 */
	writeValue(value: ITaskStatus): void {
		this.status = value;
	}

	/**
	 * Registers a callback function to be called when the status changes.
	 *
	 * @param fn - The function that is triggered on status change.
	 */
	registerOnChange(fn: (status: ITaskStatus) => void): void {
		this.onChange = fn;
	}

	/**
	 * Registers a callback function to be called when the component is touched.
	 *
	 * @param fn - The function that is triggered when the component is touched.
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 * Emits the selected status when a task status is chosen.
	 *
	 * @param status - The selected task status.
	 */
	selectStatus(status: ITaskStatus): void {
		this.onChanged.emit(status);
	}

	/**
	 * Retrieves task statuses based on the organization and project.
	 * If a project ID is available, it filters statuses accordingly.
	 * Emits the list of statuses and sets the default status if none is selected.
	 */
	getStatuses(): void {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Fetch task statuses from the service
		this._taskStatusesService
			.get<ITaskStatusFindInput>({
				tenantId,
				organizationId,
				...(this.projectId ? { projectId: this.projectId } : {})
			})
			.pipe(
				// Map the response to either the fetched statuses or a default set
				map(({ items, total }: IPagination<ITaskStatus>) => (total > 0 ? items : this._statuses)),
				// Update the observable with the fetched statuses
				tap((statuses: ITaskStatus[]) => {
					this.statuses$.next(statuses);

					// Set default status if no status is currently selected and defaultSelected is true
					if (this.defaultSelected) {
						this.setDefaultStatusIfNeeded(statuses);
					}
				}),
				untilDestroyed(this) // Clean up the subscription when component is destroyed
			)
			.subscribe();
	}

	/**
	 * Sets the default status for the task if no status is currently assigned.
	 *
	 * This method checks if the `status` property is not set. If it is not set,
	 * it looks for the default status in the provided array of statuses.
	 * If found, it assigns this default status to the `status` property and triggers
	 * the `onChange` callback with the default status.
	 *
	 * @param statuses - An array of task statuses to search for the default status.
	 *                   It should contain objects that implement the `ITaskStatus` interface.
	 */
	private setDefaultStatusIfNeeded(statuses: ITaskStatus[]): void {
		if (!this.status) {
			const defaultStatus = statuses.find((status) => status.name === TaskStatusEnum.OPEN);
			if (defaultStatus) {
				this.status = defaultStatus;
				this.onChange(defaultStatus);
			}
		}
	}

	/**
	 * Creates a new task status from the ng-select input.
	 *
	 * @param name - The name of the new status to be created.
	 * @returns A promise that resolves when the status is successfully created.
	 */
	createNew = async (name: string): Promise<void> => {
		if (!this.organization) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;

			// Prepare the task status payload
			const payload = {
				tenantId,
				organizationId,
				name,
				...(this.projectId ? { projectId: this.projectId } : {})
			};

			// Create the new task status and wait for completion
			await firstValueFrom(this._taskStatusesService.create(payload));
		} catch (error) {
			console.error('Error while creating new task status:', error);
			this._errorHandlingService.handleError(error);
		} finally {
			// Notify observers after creation attempt
			this.subject$.next(true);
		}
	};

	ngOnDestroy(): void {}
}
