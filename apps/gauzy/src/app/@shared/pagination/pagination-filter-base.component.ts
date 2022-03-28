import { AfterViewInit, Component } from "@angular/core";
import { UntilDestroy } from "@ngneat/until-destroy";
import { TranslateService } from "@ngx-translate/core";
import { isNotEmpty } from "@gauzy/common-angular";
import { Subject } from "rxjs/internal/Subject";
import { BehaviorSubject } from "rxjs/internal/BehaviorSubject";
import { TranslationBaseComponent } from "../language-base/translation-base.component";

export interface IPaginationBase {
	totalItems?: number;
	activePage: number;
	itemsPerPage: number;
}

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class PaginationFilterBaseComponent extends TranslationBaseComponent
	implements AfterViewInit {

	protected pagination: IPaginationBase = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: 10
	};
	protected subject$: Subject<any> = new Subject();
	protected pagination$: BehaviorSubject<IPaginationBase> =
		new BehaviorSubject({
			activePage: this.pagination.activePage,
			itemsPerPage: this.pagination.itemsPerPage
		});

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
			activePage: 1
		});
	}

	protected setFilter(filter: any, doEmit: boolean = true) {
		if (isNotEmpty(filter.search)) {
			this.filters = {
				where: {
					...this.filters.where,
					[filter.field]: filter.search
				}
			};
		} else {
			if (`${filter.field}` in this.filters.where) {
				delete this.filters.where[filter.field];
			}
		}
		if (doEmit) {
			this.subject$.next(true);
		}
	}

	protected onPageChange(selectedPage: number) {
		this.setPagination({
			...this.getPagination(),
			activePage: selectedPage
		});
		this.subject$.next(true);
	}

	protected getPagination(): IPaginationBase {
		return this.pagination;
	}

	protected setPagination(pagination: IPaginationBase) {
		this.pagination = pagination;

		const { activePage, itemsPerPage } = this.getPagination();
		this.pagination$.next({ activePage, itemsPerPage });
	}

	onUpdateOption($event: number) {
		this.pagination.itemsPerPage = $event;
		this.setPagination({
			...this.getPagination(),
			itemsPerPage: this.pagination.itemsPerPage
		});
    this.subject$.next(true);
	}
}
