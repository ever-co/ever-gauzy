import { Component, OnInit, OnDestroy } from '@angular/core';
import { UpworkStoreService } from 'apps/gauzy/src/app/@core/services/upwork-store.service';
import { Observable, Subject, of } from 'rxjs';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { IEngagement } from '@gauzy/models';
import { takeUntil, tap, catchError } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';

@Component({
	selector: 'ngx-sync-data-selection',
	templateUrl: './sync-data-selection.component.html',
	styleUrls: ['./sync-data-selection.component.scss']
})
export class SyncDataSelectionComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$: Subject<void> = new Subject();
	contractsSettings$: Observable<any> = this._us.contractsSettings$;
	contracts: IEngagement[];

	constructor(
		private _us: UpworkStoreService,
		private translate: TranslateService,
		private _toastr: NbToastrService,
		public dialogRef: NbDialogRef<SyncDataSelectionComponent>,
		private errorHandlingService: ErrorHandlingService
	) {
		super(translate);
	}

	ngOnInit(): void {}

	syncData() {
		this._us
			.syncDataWithContractRelated(this.contracts)
			.pipe(
				tap(() => {
					this._toastr.primary(
						this.getTranslation(
							'INTEGRATIONS.UPWORK_PAGE.CONTRACTS_RELATED_DATA'
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this.dialogRef.close();
				}),
				catchError((err) => {
					this.errorHandlingService.handleError(err);
					return of(null);
				}),
				takeUntil(this._ngDestroy$)
			)
			.subscribe();
	}

	setSelectedEmployee(employee) {
		if (employee) {
			this._us.setSelectedEmployeeId(employee.id);
		}
	}

	ngOnDestroy(): void {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
