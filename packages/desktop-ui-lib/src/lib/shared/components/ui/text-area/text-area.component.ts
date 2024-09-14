import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'gauzy-text-area',
	templateUrl: './text-area.component.html',
	styleUrls: ['./text-area.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextAreaComponent {
	private _text: string = '';
	private _hasError: boolean = false;
	private _disabled: boolean = false;
	private _label: string = '';
	private _placeholder: string = '';

	@Output() modelChange = new EventEmitter<string>();

	// Getters and setters for text with encapsulation
	@Input()
	get text(): string {
		return this._text;
	}

	set text(value: string) {
		this._text = value;
	}

	// Getters and setters for hasError
	@Input()
	get hasError(): boolean {
		return this._hasError;
	}
	set hasError(value: boolean) {
		this._hasError = value;
	}

	// Getters and setters for disabled
	@Input()
	get disabled(): boolean {
		return this._disabled;
	}
	set disabled(value: boolean) {
		this._disabled = value;
	}

	// Getters and setters for label
	@Input()
	get label(): string {
		return this._label;
	}
	set label(value: string) {
		this._label = value;
	}

	// Getters and setters for placeholder
	@Input()
	get placeholder(): string {
		return this._placeholder;
	}
	set placeholder(value: string) {
		this._placeholder = value;
	}

	// Method to handle model change
	public onModelChange(value: string): void {
		this.modelChange.emit(value);
	}
}
