import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	ViewChild,
	ElementRef,
	NgZone
} from '@angular/core';

import { Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'ga-card-grid',
	templateUrl: './card-grid.component.html',
	styleUrls: ['./card-grid.component.scss']
})
export class CardGridComponent implements OnInit, OnDestroy {
	@Input() source: any;
	@Output() onSelectedItem: EventEmitter<any> = new EventEmitter<any>();
	@Output() scroll: EventEmitter<any> = new EventEmitter<any>();
	selected: any = { isSelected: false, data: null };
	private _grid: ElementRef;
	@ViewChild('grid', { static: false }) set grid(content: ElementRef) {
		if (content) {
			this._grid = content;
			this._ngZone.run(() => {
				setTimeout(() => (this.showMore = !this._hasScrollbar()), 300);
			});
		}
	}
	private _showMore: boolean = false;

	/*
	 * Getter & Setter for dynamic columns settings
	 */
	_settings: any = {};
	get settings(): any {
		return this._settings;
	}
	@Input() set settings(settings: any) {
		this.setColumns(settings.columns);
		this._settings = settings;
	}

	/**
	 * GRID defined columns
	 */
	columns: any = [];

	constructor(private readonly _ngZone: NgZone) {}

	ngOnInit(): void {}

	getNoDataMessage() {
		return this.settings.noDataMessage;
	}

	getKeys() {
		return Object.keys(this.settings.columns);
	}

	setColumns(columns: []) {
		this.columns = columns;
	}
	getColumns() {
		return this.columns;
	}

	selectedItem(item) {
		this.selected =
			this.selected.data && item.id === this.selected.data.id
				? { isSelected: !this.selected.isSelected, data: item }
				: { isSelected: true, data: item };
		this.onSelectedItem.emit(this.selected);
	}

	onScroll(event: any) {
		this.showMore = !this._hasScrollbar();
		this.scroll.emit();
	}

	getValue(row: any, key: string) {
		if (key in this.getColumns()) {
			const column = this.getColumns()[key];
			const value = row[key];
			const valid = column['valuePrepareFunction'] instanceof Function;
			if (valid) {
				return column['valuePrepareFunction'].call(null, value, row);
			} else {
				return value;
			}
		}
	}

	private _hasScrollbar() {
		return (
			this._grid.nativeElement.scrollHeight >
			this._grid.nativeElement.clientHeight
		);
	}

	public get showMore(): boolean {
		return this._showMore && this.source.length >= 10;
	}

	public set showMore(value: boolean) {
		this._showMore = value;
	}

	ngOnDestroy() {}
}
