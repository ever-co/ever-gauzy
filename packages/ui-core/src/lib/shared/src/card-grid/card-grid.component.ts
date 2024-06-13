import { Component, OnDestroy, OnInit, Input, ViewChild, ElementRef } from '@angular/core';

import { Output, EventEmitter } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, combineLatest, debounceTime, filter, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomViewComponent } from './card-grid-custom.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-card-grid',
	templateUrl: './card-grid.component.html',
	styleUrls: ['./card-grid.component.scss']
})
export class CardGridComponent implements OnInit, OnDestroy {
	source$: BehaviorSubject<any> = new BehaviorSubject([]);
	@Input() set source(content: any) {
		this.source$.next(content);
	}
	@Output() onSelectedItem: EventEmitter<any> = new EventEmitter<any>();
	@Output() scroll: EventEmitter<any> = new EventEmitter<any>();
	selected: any = { isSelected: false, data: null };
	private _grid$: BehaviorSubject<ElementRef> = new BehaviorSubject(null);
	@ViewChild('grid', { static: false })
	set grid(content: ElementRef) {
		if (content) {
			this._grid$.next(content);
		}
	}
	get grid(): ElementRef {
		return this._grid$.getValue();
	}
	private _showMore: boolean = false;

	private _selectedCustomViewComponent: CustomViewComponent;

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

	_totalItems$: BehaviorSubject<number> = new BehaviorSubject(0);
	@Input() set totalItems(content: any) {
		this._totalItems$.next(content);
	}

	private _arrayOverflow: boolean;

	constructor() {}

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

	public selectCustomViewComponent(component: CustomViewComponent) {
		this._selectedCustomViewComponent = component;
	}

	public customComponentInstance<T>(): T {
		return this._selectedCustomViewComponent?.customComponent?.instance as T;
	}

	public clearCustomViewComponent(): void {
		if (this._selectedCustomViewComponent) {
			this._selectedCustomViewComponent = null;
			this.selected = { isSelected: false, data: null };
		}
	}

	onScroll() {
		this.scroll.emit();
	}

	ngOnInit(): void {
		const source$: Observable<any[]> = this.source$.asObservable();
		const grid$: Observable<ElementRef> = this._grid$.asObservable();
		combineLatest([source$, grid$])
			.pipe(
				debounceTime(100),
				filter(([source, grid]) => !!grid && !!source),
				tap(([source]) => {
					this._arrayOverflow = this.totalItems <= source.length;
				}),
				tap(([, grid]) => (this.showMore = !this._hasScrollbar(grid))),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieve the value of a given key from a row, optionally applying a value preparation function if defined.
	 *
	 * @param row - The data row object.
	 * @param key - The key whose value needs to be retrieved.
	 * @returns The prepared value or the raw value from the row.
	 */
	getValue(row: any, key: string): any {
		try {
			const columns = this.getColumns();
			if (key in columns) {
				const column = columns[key];
				const value = row[key];

				if (typeof column.valuePrepareFunction === 'function') {
					return column.valuePrepareFunction.call(null, value, row);
				}

				return value;
			}
			throw new Error(`Key "${key}" not found in columns.`);
		} catch (error) {
			console.error('Error getting value:', error);
			return undefined;
		}
	}

	private _hasScrollbar(grid: ElementRef) {
		return grid.nativeElement.scrollHeight > grid.nativeElement.clientHeight;
	}

	public get showMore(): boolean {
		const size = this.source.length;
		return this._showMore && size >= 10 && !this._arrayOverflow;
	}

	public set showMore(value: boolean) {
		this._showMore = value;
	}

	public get source() {
		return this.source$.getValue();
	}

	public get totalItems() {
		return this._totalItems$.getValue();
	}

	ngOnDestroy() {}
}
