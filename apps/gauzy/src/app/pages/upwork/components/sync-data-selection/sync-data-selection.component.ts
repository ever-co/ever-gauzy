import { Component, OnInit, OnDestroy } from '@angular/core';
import { UpworkStoreService } from 'apps/gauzy/src/app/@core/services/upwork-store.service';
import { Observable, of } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { IEngagement } from '@gauzy/models';
import { tap, catchError } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-sync-data-selection',
	templateUrl: './sync-data-selection.component.html',
	styleUrls: ['./sync-data-selection.component.scss']
})
export class SyncDataSelectionComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	contractsSettings$: Observable<any> = this._us.contractsSettings$;
	contracts: IEngagement[];

	constructor(
		private _us: UpworkStoreService,
		public translateService: TranslateService,
		private toastrService: ToastrService,
		public dialogRef: NbDialogRef<SyncDataSelectionComponent>,
		private errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {}

	syncData() {
		this._us
			.syncDataWithContractRelated(this.contracts)
			.pipe(
				tap(() => {
					this.toastrService.success(
						this.getTranslation(
							'INTEGRATIONS.UPWORK_PAGE.CONTRACTS_RELATED_DATA'
						)
					);
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

	ngOnDestroy(): void {}
}
