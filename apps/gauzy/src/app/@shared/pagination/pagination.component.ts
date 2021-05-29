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

	@Input() totalItems: number = 1;
	@Input() activePage: number = 1;
	@Input() itemsPerPage: number = 5;

	//OnInit enable/disable emit EventEmitter
	@Input() doEmit: boolean = true;

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
