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

	statuses: string[] = [
		this.getTranslation('TASKS_PAGE.TODO'),
		this.getTranslation('TASKS_PAGE.IN_PROGRESS'),
		this.getTranslation('TASKS_PAGE.FOR_TESTING'),
		this.getTranslation('TASKS_PAGE.COMPLETED')
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
	private _status: string;
	set status(val: string) {
		this._status = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get status(): string {
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

	writeValue(value: string) {
		this._status = value;
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	selectStatus($event) {
		this.onChanged.emit($event);
	}

	ngOnDestroy() {}
}
