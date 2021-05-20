import {
	Component,
	Output,
	EventEmitter,
	Input,
	OnInit
} from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pagination',
	templateUrl: './pagination.component.html',
	styleUrls: ['./pagination.component.scss'],
})
export class PaginationComponent implements OnInit {

	@Input() totalItems: number = 1;
	@Input() activePage: number = 1;
	@Input() itemsPerPage: number = 5;

	@Output() selectedPage = new EventEmitter<Number>();

	constructor() { }

	ngOnInit() {
		this.selectedPage.emit(this.activePage);
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
		this.selectedPage.emit(pageIdx);
	}

	onNextPageClick() {
		if (this.activePage == this.getPages().length) return;

		this.activePage++;
		this.selectedPage.emit(this.activePage);
	}

	onPrevPageClick() {
		if (this.activePage == 1) return;

		this.activePage--;
		this.selectedPage.emit(this.activePage);
	}

}
