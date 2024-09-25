import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
	selector: 'gauzy-select',
	templateUrl: './select.component.html',
	styleUrls: ['./select.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectComponent {
	private _selectedItem: string = null;
	private _items: any[] = [];
	private _bindLabel: string = 'id';
	private _bindValue: string = 'name';
	private _disabled: boolean = false;
	private _tooltipText: string = null;
	private _placeholder: string = null;
	private _label: string = null;
	private _hasError: boolean = false;
	private _canAddTag: boolean = false;
	private _isLoading: boolean = false;
	private _addTagText: string = null;
	private _clearable: boolean = true;
	private _typeahead!: Subject<string>;
	private _addTag!: Function;

	@Output() clear = new EventEmitter<void>();
	@Output() modelChange = new EventEmitter<any>();
	@Output() scrollToEnd = new EventEmitter<any>();

	// Getter and Setter for selectedItem
	@Input()
	public get selectedItem(): any {
		return this._selectedItem;
	}
	public set selectedItem(value: any) {
		this._selectedItem = value;
	}

	// Getter and Setter for items
	@Input()
	public get items(): any[] {
		return this._items;
	}
	public set items(value: any[]) {
		this._items = [...value];
	}

	// Getter and Setter for bindLabel
	@Input()
	public get bindLabel(): string {
		return this._bindLabel;
	}
	public set bindLabel(value: string) {
		this._bindLabel = value;
	}

	// Getter and Setter for bindValue
	@Input()
	public get bindValue(): string {
		return this._bindValue;
	}
	public set bindValue(value: string) {
		this._bindValue = value;
	}

	// Getter and Setter for disabled
	@Input()
	public get disabled(): boolean {
		return this._disabled;
	}
	public set disabled(value: boolean) {
		this._disabled = value;
	}

	// Getter and Setter for tooltipText
	@Input()
	public get tooltipText(): string {
		return this._tooltipText;
	}
	public set tooltipText(value: string) {
		this._tooltipText = value;
	}

	// Getter and Setter for placeholder
	@Input()
	public get placeholder(): string {
		return this._placeholder;
	}
	public set placeholder(value: string) {
		this._placeholder = value;
	}

	// Getter and Setter for label
	@Input()
	public get label(): string {
		return this._label;
	}
	public set label(value: string) {
		this._label = value;
	}

	// Getter and Setter for hasError
	@Input()
	public get hasError(): boolean {
		return this._hasError;
	}
	public set hasError(value: boolean) {
		this._hasError = value;
	}

	// Getter and Setter for canAddTag
	@Input()
	public get canAddTag(): boolean {
		return this._canAddTag;
	}
	public set canAddTag(value: boolean) {
		this._canAddTag = value;
	}

	// Getter and Setter for isLoading
	@Input()
	public get isLoading(): boolean {
		return this._isLoading;
	}
	public set isLoading(value: boolean) {
		this._isLoading = value;
	}

	// Getter and Setter for addTagText
	@Input()
	public get addTagText(): string {
		return this._addTagText;
	}
	public set addTagText(value: string) {
		this._addTagText = value;
	}

	// Getter and Setter for clearable
	@Input()
	public get clearable(): boolean {
		return this._clearable;
	}
	public set clearable(value: boolean) {
		this._clearable = value;
	}

	// Getter and Setter for addTag function
	@Input()
	public get addTag(): Function {
		return this._addTag;
	}
	public set addTag(value: Function) {
		this._addTag = value;
	}

	// Getter and Setter for selectedItem
	@Input()
	public get typeahead(): Subject<string> {
		return this._typeahead;
	}
	public set typeahead(value: Subject<string>) {
		this._typeahead = value;
	}
	// Handle clear action
	public onClear() {
		this.clear.emit();
	}

	// Emit model change event
	public onModelChange(event: any) {
		this.modelChange.emit(event);
	}

	public onScrollToEnd() {
		this.scrollToEnd.emit();
	}
}
