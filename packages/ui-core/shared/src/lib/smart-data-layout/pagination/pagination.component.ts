import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { UntilDestroy } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pagination',
	templateUrl: './pagination.component.html',
	styleUrls: ['./pagination.component.scss']
})
export class PaginationComponent implements OnInit {
	/*
	 * Getter & Setter for dynamic totalItems
	 */
	_totalItems: number = 1;
	get totalItems(): number {
		return this._totalItems;
	}
	@Input() set totalItems(value: number) {
		this._totalItems = value;
	}

	/*
	 * Getter & Setter for dynamic activePage
	 */
	_activePage: number = 1;
	get activePage(): number {
		return this._activePage;
	}
	@Input() set activePage(value: number) {
		this.subject$.next(value);
		this._activePage = value;
	}

	/*
	 * Getter & Setter for dynamic itemsPerPage
	 */
	_itemsPerPage: number = 5;
	get itemsPerPage(): number {
		return this._itemsPerPage;
	}
	@Input() set itemsPerPage(value: number) {
		this.selectedOption.emit(value);
		this._itemsPerPage = value;
	}

	/*
	 * Getter & Setter for enable/disable emit EventEmitter
	 */
	_doEmit: boolean = true;
	get doEmit(): boolean {
		return this._doEmit;
	}
	@Input() set doEmit(value: boolean) {
		this._doEmit = value;
	}

	subject$: Subject<any> = new Subject();

	@Output() selectedPage = new EventEmitter<Number>();
	@Output() selectedOption = new EventEmitter<Number>();

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				distinctUntilChange(), // do not emit pagination on multiple click on same element,
				tap(() => this.selectedPage.emit(this.activePage))
			)
			.subscribe();

		// Do not emit pagination on multiple click on same element
		if (this.doEmit) {
			this.subject$.next(this.activePage);
		}
	}

	/**
	 *
	 * @returns
	 */
	getPages() {
		const pagesCount = this.getPagesCount();
		let pages = [];
		let showPagesCount = 5;
		showPagesCount = pagesCount < showPagesCount ? pagesCount : showPagesCount;
		let middleOne = Math.ceil(showPagesCount / 2);
		middleOne = this.activePage >= middleOne ? this.activePage : middleOne;
		let lastOne = middleOne + Math.floor(showPagesCount / 2);
		lastOne = lastOne >= pagesCount ? pagesCount : lastOne;
		const firstOne = lastOne - showPagesCount + 1;
		for (let i = firstOne; i <= lastOne; i++) {
			pages.push(i);
		}
		return pages;
	}

	/**
	 *
	 * @returns
	 */
	getStartPagesCount() {
		return (this.activePage - 1) * this.itemsPerPage + 1;
	}

	/**
	 *
	 * @returns
	 */
	getEndPagesCount() {
		const entriesEndPage = (this.activePage - 1) * this.itemsPerPage + this.itemsPerPage;

		if (entriesEndPage > this.totalItems) {
			return this.totalItems;
		}
		return entriesEndPage;
	}

	/**
	 *
	 */
	getPagesCount() {
		return Math.ceil(this.totalItems / this.itemsPerPage);
	}

	/**
	 *
	 */
	onChangePage(pageIdx: number) {
		this.activePage = pageIdx;
	}

	/**
	 * Next page click
	 */
	onNextPageClick() {
		this.activePage = this.activePage >= this.getPagesCount() ? this.getPagesCount() : this.activePage + 1;
		this.subject$.next(this.activePage);
	}

	/**
	 * Previous page click
	 */
	onPrevPageClick() {
		if (this.activePage == 1) return;

		this.activePage--;
		this.subject$.next(this.activePage);
	}
}
