import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	EventEmitter,
	Output,
	AfterViewInit,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { combineLatest, firstValueFrom, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization, IOrganizationProject, IPagination, IStatus, IStatusFindInput, TaskStatusEnum } from '@gauzy/contracts';
import { distinctUntilChange, sluggable } from '@gauzy/common-angular';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { StatusesService, Store, ToastrService } from '../../../@core/services';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-status-select',
	templateUrl: './task-status-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskStatusSelectComponent),
			multi: true,
		},
	],
})
export class TaskStatusSelectComponent extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	private subject$: Subject<boolean> = new Subject();
	public selectedProjectId: IOrganizationProject['id'];
	public organization: IOrganization;
	public statuses$: BehaviorSubject<IStatus[]> = new BehaviorSubject([]);

	/**
	 * Default global task statuses
	 */
	private _statuses: Array<{ name: string; value: TaskStatusEnum & any }> = [
		{
			name: TaskStatusEnum.OPEN,
			value: sluggable(TaskStatusEnum.OPEN),
		},
		{
			name: TaskStatusEnum.IN_PROGRESS,
			value: sluggable(TaskStatusEnum.IN_PROGRESS),
		},
		{
			name: TaskStatusEnum.READY_FOR_REVIEW,
			value: sluggable(TaskStatusEnum.READY_FOR_REVIEW),
		},
		{
			name: TaskStatusEnum.IN_REVIEW,
			value: sluggable(TaskStatusEnum.IN_REVIEW),
		},
		{
			name: TaskStatusEnum.BLOCKED,
			value: sluggable(TaskStatusEnum.BLOCKED),
		},
		{
			name: TaskStatusEnum.COMPLETED,
			value: sluggable(TaskStatusEnum.COMPLETED),
		},
	];

	/*
	* Getter & Setter for dynamic add tag option
	*/
	private _addTag: boolean = true;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for status
	 */
	private _status: TaskStatusEnum;
	set status(val: TaskStatusEnum) {
		this._status = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get status(): TaskStatusEnum {
		return this._status;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() onChanged = new EventEmitter<string>();

	constructor(
		public readonly translateService: TranslateService,
		public readonly store: Store,
		public readonly statusesService: StatusesService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				tap(() => this.getStatuses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeProject$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, project]) => {
					this.organization = organization;
					this.selectedProjectId = project ? project.id : null;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: TaskStatusEnum) {
		this._status = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectStatus(event: { label: string; value: TaskStatusEnum }) {
		this.onChanged.emit(event ? event.value : null);
	}

	/**
	 * Get task statuses based organization & project
	 */
	getStatuses() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.statusesService.get<IStatusFindInput>({
			tenantId,
			organizationId,
			...(this.selectedProjectId
				? {
					projectId: this.selectedProjectId
				  }
				: {}),
		}).pipe(
			map(({ items, total }: IPagination<IStatus>) => total > 0 ? items : this._statuses),
			tap((statuses: IStatus[]) => this.statuses$.next(statuses)),
			untilDestroyed(this)
		)
		.subscribe();
	}

	/**
	 * Create new status from ng-select tag
	 *
	 * @param name
	 * @returns
	 */
	createNew = async (name: string) => {
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			const source = this.statusesService.create({
				tenantId,
				organizationId,
				name,
				...(this.selectedProjectId
					? {
						projectId: this.selectedProjectId
					  }
					: {}),
			});
			await firstValueFrom(source);
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.subject$.next(true)
		}
	};

	ngOnDestroy(): void {}
}
