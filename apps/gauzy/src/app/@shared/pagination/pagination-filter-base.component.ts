import { AfterViewInit, Component } from "@angular/core";
import { UntilDestroy } from "@ngneat/until-destroy";
import { TranslateService } from "@ngx-translate/core";
import { isNotEmpty } from "@gauzy/common-angular";
import { Subject } from "rxjs/internal/Subject";
import { TranslationBaseComponent } from "../language-base/translation-base.component";

@UntilDestroy({ checkProperties: true })
@Component({
	template: ''
})
export class PaginationFilterBaseComponent extends TranslationBaseComponent implements AfterViewInit {
    
	protected pagination: any = {
        totalItems: 0,
		activePage: 1,
		itemsPerPage: 10
	};
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
		this.pagination['activePage'] = 1;
	}

	protected setFilter(
		filter: any, 
		doEmit: boolean = true
	) {
		if (isNotEmpty(filter.search)) {
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
		if (doEmit) {
			this.subject$.next();
		}
	}

    protected onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
        this.subject$.next();
	}
}