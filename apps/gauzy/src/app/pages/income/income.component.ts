import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum, Income } from '@gauzy/models';
import { Subject, Observable, forkJoin } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { IncomeService } from '../../@core/services/income.service';
import { LocalDataSource } from 'ng2-smart-table';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { IncomeMutationComponent } from '../../@shared/income/income-mutation/income-mutation.component';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

interface SelectedRowModel {
  data: Income;
  isSelected: boolean;
  selected: Income[];
  source: LocalDataSource;
}

@Component({
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.scss']
})
export class IncomeComponent implements OnInit, OnDestroy {
  // protected smartTableSettings: object;

  constructor(
    private authService: AuthService,
    private store: Store,
    private incomeService: IncomeService,
    private dialogService: NbDialogService,
    private toastrService: NbToastrService,
    private route: ActivatedRoute,
    private translateService: TranslateService
  ) {
    // this.loadSettingsSmartTable();
    // this._applyTranslationOnSmartTable();
  }

  async ngOnInit() {
    this.hasRole = await this.authService
      .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
      .pipe(first())
      .toPromise();

    this.store.selectedDate$
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe(date => {
        this.selectedDate = date;

        if (this.selectedEmployeeId) {
          this._loadEmployeeIncomeData(this.selectedEmployeeId);
        } else {
          const selectedOrg = this.store.selectedOrganization;

          if (selectedOrg && selectedOrg.id) {
            this._loadEmployeeIncomeData(null, selectedOrg.id);
          }
        }
      });

    this.store.selectedEmployee$
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe(employee => {
        if (employee && employee.id) {
          this.selectedEmployeeId = employee.id;
          this._loadEmployeeIncomeData(employee.id);
        } else {
          const selectedOrg = this.store.selectedOrganization;
          if (selectedOrg && selectedOrg.id) {
            this._loadEmployeeIncomeData(null, selectedOrg.id);
          }
        }
      });

    this.store.selectedOrganization$
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe(org => {
        if (org) {
          this.store.selectedEmployee = null;
          this._loadEmployeeIncomeData(null, org.id);
        }
      })

    this.route.queryParamMap
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe(params => {
        if (params.get('openAddDialog')) {
          this.addIncome();
        }
      });
  }

  static smartTableSettings = {
    actions: false,
    mode: 'external',
    editable: true,
    noDataMessage: 'No data for the currently selected employee.',
    columns: {
      valueDate: {
        title: 'Date',
        type: 'custom',
        width: '20%',
        renderComponent: DateViewComponent,
        filter: false
      },
      clientName: {
        title: 'Client Name',
        type: 'string'
      },
      amount: {
        title: 'Value',
        type: 'number',
        width: '15%',
        filter: false
      },
      notes: {
        title: 'Notes',
        type: 'string'
      }
    },
    pager: {
      display: true,
      perPage: 8
    }
  }
  // private loadSettingsSmartTable() {
  //   this.smartTableSettings = {
  //     actions: false,
  //     mode: 'external',
  //     editable: true,
  //     noDataMessage: 'No data for the currently selected employee.',
  //     columns: {
  //       valueDate: {
  //         title: this.getTranslation('INCOME_PAGE.SM_TABLE.DATE'),
  //         type: 'custom',
  //         width: '20%',
  //         renderComponent: DateViewComponent,
  //         filter: false
  //       },
  //       clientName: {
  //         title: this.getTranslation('INCOME_PAGE.SM_TABLE.CLIENT_NAME'),
  //         type: 'string'
  //       },
  //       amount: {
  //         title: this.getTranslation('INCOME_PAGE.SM_TABLE.VALUE'),
  //         type: 'number',
  //         width: '15%',
  //         filter: false
  //       },
  //       notes: {
  //         title: this.getTranslation('INCOME_PAGE.SM_TABLE.NOTES'),
  //         type: 'string'
  //       }
  //     },
  //     pager: {
  //       display: true,
  //       perPage: 8
  //     }
  //   };
  // }

  // getTranslation(prefix: string) {
  //   let result = '';
  //   this.translateService.get(prefix).subscribe(res => {
  //     result = res;
  //   });
  //   console.log(result);

  //   return result;
  // }

  // private _applyTranslationOnSmartTable() {
  //   this.translateService.onLangChange.subscribe(() => {
  //     this.loadSettingsSmartTable();
  //   });
  // }

  get smartTableSettings() {
    return IncomeComponent.smartTableSettings;
  }

  private _ngDestroy$ = new Subject<void>();

  hasRole: boolean;
  selectedEmployeeId: string;
  selectedDate: Date;
  smartTableSource = new LocalDataSource();

  selectedIncome: SelectedRowModel;

  selectIncome(ev: SelectedRowModel) {
    this.selectedIncome = ev;
  }

  async addIncome() {
    const result = await this.dialogService
      .open(IncomeMutationComponent)
      .onClose.pipe(first())
      .toPromise();
    if (result) {
      try {
        await this.incomeService.create({
          amount: result.amount,
          clientName: result.client.clientName,
          clientId: result.client.clientId,
          valueDate: result.valueDate,
          employeeId: this.selectedEmployeeId,
          notes: result.notes,
          currency: result.currency
        });

        this.toastrService.info('Income added.', 'Success');

        this._loadEmployeeIncomeData();
      } catch (error) {
        this.toastrService.danger(
          error.error.message || error.message,
          'Error'
        );
      }
    }
  }

  async editIncome() {
    this.dialogService
      .open(IncomeMutationComponent, {
        context: {
          income: this.selectedIncome.data
        }
      })
      .onClose.pipe(takeUntil(this._ngDestroy$))
      .subscribe(async result => {
        if (result) {
          try {
            await this.incomeService.update(this.selectedIncome.data.id, {
              amount: result.amount,
              clientName: result.client.clientName,
              clientId: result.client.clientId,
              valueDate: result.valueDate,
              notes: result.notes,
              currency: result.currency
            });

            this.toastrService.info('Income edited.', 'Success');
            this._loadEmployeeIncomeData();
            this.selectedIncome = null;
          } catch (error) {
            this.toastrService.danger(
              error.error.message || error.message,
              'Error'
            );
          }
        }
      });
  }

  async deleteIncome() {
    this.dialogService
      .open(DeleteConfirmationComponent, {
        context: { recordType: 'Income' }
      })
      .onClose.pipe(takeUntil(this._ngDestroy$))
      .subscribe(async result => {
        if (result) {
          try {
            await this.incomeService.delete(this.selectedIncome.data.id);

            this.toastrService.info('Income deleted.', 'Success');
            this._loadEmployeeIncomeData();
            this.selectedIncome = null;
          } catch (error) {
            this.toastrService.danger(
              error.error.message || error.message,
              'Error'
            );
          }
        }
      });
  }

  private async _loadEmployeeIncomeData(employeId = this.selectedEmployeeId, orgId?: string) {
    let findObj;

    if (orgId) {
      findObj = {
        organization: {
          id: orgId
        }
      }
    } else {
      findObj = {
        employee: {
          id: employeId
        }
      }
    }

    const { items } = await this.incomeService.getAll(
      ['employee'],
      findObj,
      this.selectedDate
    );

    this.smartTableSource.load(items);
  }

  ngOnDestroy() {
    this._ngDestroy$.next();
    this._ngDestroy$.complete();
  }
}
