/* It's a pagination component that works with the angular2-smart-table component */
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { LocalDataSource } from 'angular2-smart-table';
import { Subscription, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-pagination',
	templateUrl: './pagination-v2.component.html',
	styleUrls: ['./pagination-v2.component.scss']
})
export class PaginationV2Component implements OnChanges, OnDestroy {
	private _source: LocalDataSource;
	private _perPageSelect: any[];
	private _currentPerPage: any;
	private _pages: Array<any>;
	private _page: number;
	private _count: number = 0;
	private _perPage: number;
	private _changePage: EventEmitter<{ page: number }>;
	private _dataChangedSub: Subscription;

	constructor() {
		this._changePage = new EventEmitter<{ page: number }>();
		this._perPageSelect = [5, 10, 25, 50, 100];
	}

	/**
	 *
	 * @param changes
	 */
	private _processPageChange(changes: any) {
		if (changes['action'] === 'prepend') {
			this._source.setPage(1);
		}
		if (changes['action'] === 'append') {
			this._source.setPage(this.last);
		}
	}

	/**
	 * Init pages
	 */
	private _initPages() {
		const pagesCount = this.last;
		let showPagesCount = 4;
		showPagesCount = pagesCount < showPagesCount ? pagesCount : showPagesCount;
		this._pages = [];

		if (this.isShouldShow) {
			let middleOne = Math.ceil(showPagesCount / 2);
			middleOne = this._page >= middleOne ? this._page : middleOne;

			let lastOne = middleOne + Math.floor(showPagesCount / 2);
			lastOne = lastOne >= pagesCount ? pagesCount : lastOne;

			const firstOne = lastOne - showPagesCount + 1;

			for (let i = firstOne; i <= lastOne; i++) {
				this._pages.push(i);
			}
		}
	}

	/**
	 * On changes
	 *
	 * @param changes
	 */
	public ngOnChanges(changes: SimpleChanges) {
		if (changes.source) {
			if (!changes.source.firstChange) {
				this._dataChangedSub.unsubscribe();
			}
			this._dataChangedSub = this._source
				.onChanged()
				.pipe(
					tap((dataChanges) => {
						this._page = this._source.getPaging().page;
						this._perPage = this._source.getPaging().perPage;
						this._currentPerPage = this._perPage;
						this._count = this._source.count();
						if (this.isPageOutOfBounce) {
							this._source.setPage(--this._page);
						}

						this._processPageChange(dataChanges);
						this._initPages();
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	public get isShouldShow(): boolean {
		return this._source.count() > this._perPage;
	}

	public paginate(page: number): boolean {
		this._source.setPage(page);
		this._page = page;
		this.changePage.emit({ page });
		return false;
	}

	public next(): boolean {
		return this.paginate(this._page + 1);
	}

	public prev(): boolean {
		return this.paginate(this._page - 1);
	}

	public get last(): number {
		return Math.ceil(this._count / this._perPage);
	}

	public get isPageOutOfBounce(): boolean {
		return this._page * this._perPage >= this._count + this._perPage && this._page > 1;
	}

	public onChangePerPage(event: any) {
		this._currentPerPage = event;
		if (this._currentPerPage) {
			if (typeof this._currentPerPage === 'string' && this._currentPerPage.toLowerCase() === 'all') {
				this._source.getPaging().perPage = null;
			} else {
				this._source.getPaging().perPage = this._currentPerPage * 1;
				this._source.refresh();
			}
			this._initPages();
		}
	}

	public get startCount() {
		return (this._page - 1) * this._perPage + 1;
	}
	public get endCount() {
		const entriesEndPage: number = (this._page - 1) * this._perPage + this._perPage;

		if (entriesEndPage > this._count) {
			return this._count;
		}
		return entriesEndPage;
	}

	@Input()
	public set source(value: LocalDataSource) {
		this._source = value;
	}
	public get source(): LocalDataSource {
		return this._source;
	}

	@Input()
	public set perPageSelect(values: any[]) {
		this._perPageSelect = values;
	}

	public get perPageSelect(): any[] {
		return this._perPageSelect;
	}

	public get currentPerPage(): any {
		return this._currentPerPage;
	}
	public set currentPerPage(value: any) {
		this._currentPerPage = value;
	}
	protected get pages(): Array<any> {
		return this._pages;
	}
	protected set pages(value: Array<any>) {
		this._pages = value;
	}

	protected get page(): number {
		return this._page;
	}
	protected set page(value: number) {
		this._page = value;
	}

	protected get count(): number {
		return this._count;
	}
	protected set count(value: number) {
		this._count = value;
	}
	protected get perPage(): number {
		return this._perPage;
	}
	protected set perPage(value: number) {
		this._perPage = value;
	}

	@Output()
	public get changePage(): EventEmitter<{ page: number }> {
		return this._changePage;
	}

	ngOnDestroy(): void {}
}
