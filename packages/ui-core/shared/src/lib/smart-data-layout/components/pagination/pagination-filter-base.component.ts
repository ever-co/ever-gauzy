import { AfterViewInit, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs/internal/Subject';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { cleanKeys, isNotEmpty, mergeDeep } from '@gauzy/ui-core/common';

export interface IPaginationBase {
	totalItems?: number;
	activePage: number;
	itemsPerPage: number;
}

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class PaginationFilterBaseComponent extends TranslationBaseComponent implements AfterViewInit {
	public activePage: number = 1;
	public totalItems: number = 0;
	public itemsPerPage: number = 10;
	/**
	 * Getter for minimum items per page
	 * Can't be modified outside the class
	 */
	private _minItemPerPage: number = 10;
	public get minItemPerPage() {
		return this._minItemPerPage;
	}

	private _pagination: IPaginationBase = {
		totalItems: this.totalItems,
		activePage: this.activePage,
		itemsPerPage: this.itemsPerPage
	};
	public get pagination(): IPaginationBase {
		return this._pagination;
	}
	protected set pagination(value: IPaginationBase) {
		this._pagination = value;
	}

	protected pagination$: BehaviorSubject<IPaginationBase> = new BehaviorSubject({
		activePage: this.pagination.activePage,
		itemsPerPage: this.pagination.itemsPerPage
	});

	protected subject$: Subject<any> = new Subject();

	/*
	 * getter setter for filters
	 */
	protected _filters: any = {};
	set filters(val: any) {
		this._filters = val;
	}
	get filters() {
		return this._filters;
	}

	constructor(public readonly translateService: TranslateService) {
		super(translateService);
	}

	ngAfterViewInit() {}

	/*
	 * refresh pagination
	 */
	protected refreshPagination() {
		this.setPagination({
			...this.getPagination(),
			activePage: this.activePage,
			itemsPerPage: this.minItemPerPage
		});
	}

	/**
	 * Set filter for data based on the provided filter object.
	 * @param filter - The filter object containing information about the field and search criteria.
	 * @param doEmit - A boolean flag indicating whether to emit a notification after setting the filter. Default is true.
	 */
	protected setFilter(filter: any, doEmit: boolean = true) {
		// Split the field path into an array of field names
		const fields = filter.field.split('.');

		// Check if the search criteria is not empty or a boolean
		if (isNotEmpty(filter.search) || 'boolean' === typeof filter.search) {
			const search = filter.search;

			// Create an object with nested keys representing the field path and set the search value
			const keys = fields.reduceRight((value: string, key: string) => ({ [key]: value }), search);

			// Update the 'where' property in the 'filters' object with the new keys
			this.filters = {
				where: {
					...this.filters.where,
					...keys,
					...mergeDeep(this.filters.where, keys)
				}
			};
		} else {
			// If the search criteria is empty or not a boolean, remove the field from the 'where' property
			const [field] = fields.reverse();
			cleanKeys(this.filters.where, field);
		}

		// Emit a notification if doEmit is true
		if (doEmit) {
			this.subject$.next(true);
		}
	}

	public onPageChange(selectedPage: number) {
		this.setPagination({
			...this.getPagination(),
			activePage: selectedPage
		});

		// Scroll to the table top
		this.scrollTop();
	}

	protected getPagination(): IPaginationBase {
		return this.pagination;
	}

	protected setPagination(pagination: IPaginationBase) {
		this.pagination = pagination;

		const { activePage, itemsPerPage } = this.getPagination();
		this.pagination$.next({ activePage, itemsPerPage });
	}

	public onUpdateOption(itemsPerPage: number) {
		this.refreshPagination();
		this.pagination.itemsPerPage = itemsPerPage;
		this.setPagination({
			...this.getPagination(),
			itemsPerPage: this.pagination.itemsPerPage
		});
	}

	public onScroll() {
		const activePage = this.pagination.activePage + 1;
		this.setPagination({
			...this.getPagination(),
			activePage: activePage
		});
	}

	/**
	 * Scroll to the table top after set pagination
	 */
	protected scrollTop() {
		try {
			const table = document.querySelector('angular2-smart-table > table');
			if (!!table) {
				table.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		} catch (error) {
			console.log('Error while scrolling to the table top', error);
		}
	}
}
