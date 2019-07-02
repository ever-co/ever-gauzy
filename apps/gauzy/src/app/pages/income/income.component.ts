import { Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../@core/services/auth.service';
import { RolesEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';

@Component({
  templateUrl: './income.component.html',
  styleUrls: ['./income.component.scss']
})
export class IncomeComponent implements OnInit, OnDestroy {
  private _ngDestroy$ = new Subject<void>();
  hasRole: boolean;

  smartTableSettings = {
    actions: false,
    editable: true,
    columns: {
      date: {
        title: 'Date',
        type: 'string',
        filter: false
      },
      incomeType: {
        title: 'Income Type',
        type: 'string',
        filter: false
      },
      bonus: {
        title: 'Value',
        type: 'number',
        width: '15%',
        filter: false
      }
    },
    pager: {
      display: true,
      perPage: 8
    }
  };

  constructor(private authService: AuthService, private store: Store) {}

  ngOnInit() {
    this.authService
      .hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
      .pipe(takeUntil(this._ngDestroy$))
      .subscribe(data => (this.hasRole = data));
  }

  ngOnDestroy() {
    this._ngDestroy$.next();
    this._ngDestroy$.complete();
  }
}
