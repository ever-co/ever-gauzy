import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store, monthNames } from '@gauzy/ui-core/core';
import { IOrganization, IRecurringExpenseModel } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-recurring-expense-history',
	templateUrl: './recurring-expense-history.component.html',
	styleUrls: ['./recurring-expense-history.component.scss']
})
export class RecurringExpenseHistoryComponent extends TranslationBaseComponent implements OnInit {
	@Input()
	recordsData: IRecurringExpenseModel[] = [];

	@Output()
	closeHistory = new EventEmitter<void>();

	public organization: IOrganization;

	constructor(public readonly translateService: TranslateService, private readonly store: Store) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	emitClose = () => {
		this.closeHistory.emit();
	};

	getMonthString(month: number) {
		return monthNames[month];
	}
}
