import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	EventEmitter,
	Output
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { TaskStatusEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-task-status-select',
	templateUrl: './task-status-select.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TaskStatusSelectComponent),
			multi: true
		}
	]
})
export class TaskStatusSelectComponent extends TranslationBaseComponent implements OnInit, OnDestroy {

	statuses: Array<{ label: string, value: TaskStatusEnum}> = [
		{
			label: this.getTranslation('TASKS_PAGE.TODO'),
			value: TaskStatusEnum.TODO
		},
		{
			label: this.getTranslation('TASKS_PAGE.IN_PROGRESS'),
			value: TaskStatusEnum.IN_PROGRESS
		},
		{
			label: this.getTranslation('TASKS_PAGE.FOR_TESTING'),
			value: TaskStatusEnum.FOR_TESTING
		},
		{
			label: this.getTranslation('TASKS_PAGE.COMPLETED'),
			value: TaskStatusEnum.COMPLETED
		}
	];

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
	) {
		super(translateService)
	}

	ngOnInit() {}

	writeValue(value: TaskStatusEnum) {
		this._status = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectStatus(event: { label: string, value: TaskStatusEnum}) {
		this.onChanged.emit((event) ? event.value : null);
	}

	ngOnDestroy() {}
}
