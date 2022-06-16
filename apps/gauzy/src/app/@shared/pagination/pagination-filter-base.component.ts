import { AfterViewInit, Component } from '@angular/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { cleanKeys, isNotEmpty, mergeDeep } from '@gauzy/common-angular';
import { Subject } from 'rxjs/internal/Subject';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslationBaseComponent } from '../language-base/translation-base.component';

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

	/**
	 * Getter for minimum items per page
	 * Can't be modified outside the class
	 */
	private _minItemPerPage: number = 10;
	protected get minItemPerPage() {
		return this._minItemPerPage;
	}

	protected pagination: IPaginationBase = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: 10
	};
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
			activePage: 1
		});
	}

	protected setFilter(filter: any, doEmit: boolean = true) {
		const fields = filter.field.split('.');
		if (isNotEmpty(filter.search)) {
			const search = filter.search;
			const keys = fields.reduceRight(
				(value: string, key: string) => ({[key]: value}),
				search
			);
			this.filters = {
				where: {
					...this.filters.where,
					...keys,
					...mergeDeep(this.filters.where, keys)
				}
			};
		} else {
			const [field] = fields.reverse();
			cleanKeys(this.filters.where, field);
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
	}

	protected getPagination(): IPaginationBase {
		return this.pagination;
	}

	protected setPagination(pagination: IPaginationBase) {
		this.pagination = pagination;

		const { activePage, itemsPerPage } = this.getPagination();
		this.pagination$.next({ activePage, itemsPerPage });
	}

	onUpdateOption(itemsPerPage: number) {
		this.pagination.itemsPerPage = itemsPerPage;
		this.setPagination({
			...this.getPagination(),
			itemsPerPage: this.pagination.itemsPerPage
		});
	}
}
