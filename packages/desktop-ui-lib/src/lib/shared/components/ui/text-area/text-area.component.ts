import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'gauzy-text-area',
	templateUrl: './text-area.component.html',
	styleUrls: ['./text-area.component.scss']
})
export class TextAreaComponent {
	@Input() label!: string;
	@Input() text!: string;
	@Input() hasError: boolean = false;
	@Input() disabled: boolean = false;
	@Input() placeholder!: string;
	@Output() modelChange = new EventEmitter<string>();

	onModelChange(event: string) {
		this.modelChange.emit(event);
	}
}
