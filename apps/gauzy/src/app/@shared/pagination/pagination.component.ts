import {
	Component,
	Output,
	EventEmitter,
	Input,
	OnInit
} from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { Subject } from 'rxjs/internal/Subject';
import { debounceTime, tap } from 'rxjs/operators';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pagination',
	templateUrl: './pagination.component.html',
	styleUrls: ['./pagination.component.scss'],
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

	constructor() { }

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(100),
				distinctUntilChange(), // do not emit pagination on multiple click on same element,
				tap(() => this.selectedPage.emit(this.activePage))
			)
			.subscribe();
		if (this.doEmit) {
			this.subject$.next(this.activePage);
		}
	}

	getPages() {
		let countItems = Math.ceil(this.totalItems / this.itemsPerPage);
		let pages = [];

		for (let i = 1; i <= countItems; i++) {
			pages.push(i)
		}

		return pages;
	}

	onChangePage(pageIdx: number) {
		this.activePage = pageIdx;
		this.subject$.next(this.activePage);
	}

	onNextPageClick() {
		if (this.activePage == this.getPages().length) return;

		this.activePage++;
		this.subject$.next(this.activePage);
	}

	onPrevPageClick() {
		if (this.activePage == 1) return;

		this.activePage--;
		this.subject$.next(this.activePage);
	}
}
