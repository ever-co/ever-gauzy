import { Component, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { IEngagement } from '@gauzy/contracts';
import { tap, catchError } from 'rxjs/operators';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ErrorHandlingService, ToastrService, UpworkStoreService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	selector: 'ngx-sync-data-selection',
	templateUrl: './sync-data-selection.component.html',
	styleUrls: ['./sync-data-selection.component.scss'],
	standalone: false
})
export class SyncDataSelectionComponent extends TranslationBaseComponent {
	private readonly _us = inject(UpworkStoreService);
	private readonly toastrService = inject(ToastrService);
	public readonly dialogRef = inject(NbDialogRef<SyncDataSelectionComponent>);
	private readonly errorHandlingService = inject(ErrorHandlingService);

	contractsSettings$: Observable<any> = this._us.contractsSettings$;
	contracts: IEngagement[];

	constructor() {
		super(inject(TranslateService));
	}

	syncData() {
		this._us
			.syncDataWithContractRelated(this.contracts)
			.pipe(
				tap(() => {
					this.toastrService.success(this.getTranslation('INTEGRATIONS.UPWORK_PAGE.CONTRACTS_RELATED_DATA'));
					this.dialogRef.close();
				}),
				catchError((err) => {
					this.errorHandlingService.handleError(err);
					return of(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setSelectedEmployee(employee) {
		if (employee) {
			this._us.setSelectedEmployeeId(employee.id);
		}
	}
}
