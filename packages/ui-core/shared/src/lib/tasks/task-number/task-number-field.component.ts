import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TasksService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-task-number-field',
	templateUrl: './task-number-field.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskNumberFieldComponent),
			multi: true
		}
	]
})
export class TaskNumberFieldComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() formControl: FormControl = new FormControl();

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for project
	 */
	_projectId: string;
	get projectId(): string {
		return this._projectId;
	}
	@Input() set projectId(value: string) {
		this._projectId = value;
		this.number$.next(true);
	}

	/*
	 * Getter & Setter for status
	 */
	private _number: number;
	set number(val: number) {
		this._number = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get number(): number {
		return this._number;
	}

	onChange: any = () => {};
	onTouched: any = () => {};

	public organization: IOrganization;
	number$: Subject<boolean> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly tasksService: TasksService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.number$
			.pipe(
				tap(() => this.getOneMaximumTaskNumber()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.number$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	writeValue(value: number) {
		this._number = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	private async getOneMaximumTaskNumber() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		try {
			this.tasksService
				.getMaxTaskNumber({
					tenantId,
					organizationId,
					...(this.projectId
						? {
								projectId: this.projectId
						  }
						: {})
				})
				.pipe(
					tap((maxNumber: number) => (this.number = maxNumber + 1)),
					untilDestroyed(this)
				)
				.subscribe();
		} catch (error) {
			console.log('Error while getting max task number', error);
		}
	}

	ngOnDestroy(): void {}
}
