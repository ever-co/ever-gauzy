import { AfterViewInit, Component } from "@angular/core";
import { UntilDestroy } from "@ngneat/until-destroy";
import { TranslateService } from "@ngx-translate/core";
import { Subject } from "rxjs/internal/Subject";
import { TranslationBaseComponent } from "../language-base/translation-base.component";

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class PaginationFilterBaseComponent extends TranslationBaseComponent implements AfterViewInit {
    
    pagination: any = {
        totalItems: 0,
		activePage: 1,
		itemsPerPage: 10
	};
    subject$: Subject<any> = new Subject();

    /*
	* getter setter for filters 
	*/
	private _filters: any = {};
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
	refreshPagination() {
		this.pagination['activePage'] = 1;
	}

	setFilter(
		filters: Array<any>, 
		doEmit: boolean = true
	) {
		if (filters && filters.length > 0) {
			filters.forEach((filter) => {
				if (filter.search) {
					this.filters = {
						where: { 
							...this.filters.where, 
							[filter.field]: filter.search 
						}
					}
				} else {
					if (`${filter.field}` in this.filters.where) {
						delete this.filters.where[filter.field];
					}
				}
			});
		}
		if (doEmit) {
			this.subject$.next();
		}
	}

    onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
        this.subject$.next();
	}
}