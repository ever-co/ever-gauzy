import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
	selector: 'gauzy-select',
	templateUrl: './select.component.html',
	styleUrls: ['./select.component.scss']
})
export class SelectComponent {
	private _selectedItem: string = '';
	private _items: any[] = [];
	private _bindLabel: string = 'id';
	private _bindValue: string = '';
	private _disabled: boolean = false;
	private _tooltipText: string = '';
	private _placeholder: string = '';
	private _label: string = '';
	private _hasError: boolean = false;
	private _canAddTag: boolean = false;
	private _isLoading: boolean = false;
	private _addTagText: string = '';
	private _clearable: boolean = true;
	private _addTag!: Function;

	@Output() clear = new EventEmitter<void>();
	@Output() modelChange = new EventEmitter<any>();

	// Getter and Setter for selectedItem
	@Input()
	public get selectedItem(): any {
		return this._selectedItem;
	}
	public set selectedItem(value: any) {
		if (this._selectedItem !== value) {
			this._selectedItem = value;
		}
	}

	// Getter and Setter for items
	@Input()
	public get items(): any[] {
		return this._items;
	}
	public set items(value: any[]) {
		if (value && value.length !== this._items.length) {
			this._items = value;
		}
	}

	// Getter and Setter for bindLabel
	@Input()
	public get bindLabel(): string {
		return this._bindLabel;
	}
	public set bindLabel(value: string) {
		if (value && this._bindLabel !== value) {
			this._bindLabel = value;
		}
	}

	// Getter and Setter for bindValue
	@Input()
	public get bindValue(): string {
		return this._bindValue;
	}
	public set bindValue(value: string) {
		if (value && this._bindValue !== value) {
			this._bindValue = value;
		}
	}

	// Getter and Setter for disabled
	@Input()
	public get disabled(): boolean {
		return this._disabled;
	}
	public set disabled(value: boolean) {
		if (this._disabled !== value) {
			this._disabled = value;
		}
	}

	// Getter and Setter for tooltipText
	@Input()
	public get tooltipText(): string {
		return this._tooltipText;
	}
	public set tooltipText(value: string) {
		if (value && this._tooltipText !== value) {
			this._tooltipText = value;
		}
	}

	// Getter and Setter for placeholder
	@Input()
	public get placeholder(): string {
		return this._placeholder;
	}
	public set placeholder(value: string) {
		if (value && this._placeholder !== value) {
			this._placeholder = value;
		}
	}

	// Getter and Setter for label
	@Input()
	public get label(): string {
		return this._label;
	}
	public set label(value: string) {
		if (value && this._label !== value) {
			this._label = value;
		}
	}

	// Getter and Setter for hasError
	@Input()
	public get hasError(): boolean {
		return this._hasError;
	}
	public set hasError(value: boolean) {
		if (this._hasError !== value) {
			this._hasError = value;
		}
	}

	// Getter and Setter for canAddTag
	@Input()
	public get canAddTag(): boolean {
		return this._canAddTag;
	}
	public set canAddTag(value: boolean) {
		if (this._canAddTag !== value) {
			this._canAddTag = value;
		}
	}

	// Getter and Setter for isLoading
	@Input()
	public get isLoading(): boolean {
		return this._isLoading;
	}
	public set isLoading(value: boolean) {
		if (this._isLoading !== value) {
			this._isLoading = value;
		}
	}

	// Getter and Setter for addTagText
	@Input()
	public get addTagText(): string {
		return this._addTagText;
	}
	public set addTagText(value: string) {
		if (value && this._addTagText !== value) {
			this._addTagText = value;
		}
	}

	// Getter and Setter for clearable
	@Input()
	public get clearable(): boolean {
		return this._clearable;
	}
	public set clearable(value: boolean) {
		if (this._clearable !== value) {
			this._clearable = value;
		}
	}

	// Getter and Setter for addTag function
	@Input()
	public get addTag(): Function {
		return this._addTag;
	}
	public set addTag(value: Function) {
		if (value && this._addTag !== value) {
			this._addTag = value;
		}
	}

	// Handle clear action
	public onClear() {
		this.clear.emit();
	}

	// Emit model change event
	public onModelChange(event: any) {
		this.modelChange.emit(event);
	}
}
