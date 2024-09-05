import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'gauzy-select',
	templateUrl: './select.component.html',
	styleUrls: ['./select.component.scss']
})
export class SelectComponent {
	@Input() label!: string;
	@Input() selectedItem: any;
	@Input() items!: any[];
	@Input() bindLabel!: string;
	@Input() bindValue!: string;
	@Input() hasError: boolean = false;
	@Input() canAddTag: boolean = false;
	@Input() isLoading: boolean = false;
	@Input() addTagText!: string;
	@Input() addTag!: Function;
	@Input() disabled!: boolean;
	@Input() tooltipText!: string;
	@Input() placeholder!: string;
	@Output() clear = new EventEmitter<void>();
	@Output() modelChange = new EventEmitter<any>();

	public onClear() {
		this.clear.emit();
	}

	public onModelChange(event: any) {
		this.modelChange.emit(event);
	}
}
