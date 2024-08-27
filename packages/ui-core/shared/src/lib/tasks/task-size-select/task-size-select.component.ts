import { Component, OnInit, OnDestroy, Input, forwardRef, EventEmitter, Output, AfterViewInit } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { combineLatest, debounceTime, firstValueFrom, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import {
	IOrganization,
	IOrganizationProject,
	IPagination,
	ITaskSize,
	ITaskSizeFindInput,
	TaskSizeEnum
} from '@gauzy/contracts';
import { distinctUntilChange, sluggable } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';
import { TaskSizesService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-task-size-select',
	templateUrl: './task-size-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskSizeSelectComponent),
			multi: true
		}
	]
})
export class TaskSizeSelectComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	private subject$: Subject<boolean> = new Subject();
	public organization: IOrganization;
	public sizes$: BehaviorSubject<ITaskSize[]> = new BehaviorSubject([]);

	/**
	 * Default global task sizes
	 */
	private _sizes: Array<{ name: string; value: TaskSizeEnum & any }> = [
		{
			name: TaskSizeEnum.X_LARGE,
			value: sluggable(TaskSizeEnum.X_LARGE)
		},
		{
			name: TaskSizeEnum.LARGE,
			value: sluggable(TaskSizeEnum.LARGE)
		},
		{
			name: TaskSizeEnum.MEDIUM,
			value: sluggable(TaskSizeEnum.MEDIUM)
		},
		{
			name: TaskSizeEnum.SMALL,
			value: sluggable(TaskSizeEnum.SMALL)
		},
		{
			name: TaskSizeEnum.TINY,
			value: sluggable(TaskSizeEnum.TINY)
		}
	];

	/*
	 * Getter & Setter for selected organization project
	 */
	private _projectId: IOrganizationProject['id'];
	get projectId(): IOrganizationProject['id'] {
		return this._projectId;
	}
	@Input() set projectId(value: IOrganizationProject['id']) {
		this._projectId = value;
		this.subject$.next(true);
	}

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
	 * Getter & Setter for size
	 */
	private _size: ITaskSize;
	set size(val: ITaskSize) {
		this._size = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get size(): ITaskSize {
		return this._size;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	@Output() onChanged = new EventEmitter<ITaskSize>();

	constructor(
		public readonly translateService: TranslateService,
		public readonly store: Store,
		public readonly taskSizesService: TaskSizesService,
		private readonly toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getTaskSizes()),
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
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: ITaskSize) {
		this.size = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectSize(size: ITaskSize) {
		this.onChanged.emit(size);
	}

	/**
	 * Get task sizes based organization & project
	 */
	getTaskSizes() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.taskSizesService
			.get<ITaskSizeFindInput>({
				tenantId,
				organizationId,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			})
			.pipe(
				map(({ items, total }: IPagination<ITaskSize>) => (total > 0 ? items : this._sizes)),
				tap((sizes: ITaskSize[]) => this.sizes$.next(sizes)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create new size from ng-select tag
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

			const source = this.taskSizesService.create({
				tenantId,
				organizationId,
				name,
				...(this.projectId
					? {
							projectId: this.projectId
					  }
					: {})
			});
			const size: ITaskSize = await firstValueFrom(source);
			if (size.value) {
				this.size = size;
			}
		} catch (error) {
			this.toastrService.error(error);
		} finally {
			this.subject$.next(true);
		}
	};

	ngOnDestroy(): void {}
}
