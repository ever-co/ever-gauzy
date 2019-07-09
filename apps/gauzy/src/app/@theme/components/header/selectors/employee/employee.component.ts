import { Component, OnInit, OnDestroy } from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';

@Component({
    selector: 'ga-employee-selector',
    templateUrl: './employee.component.html',
    styleUrls: ['./employee.component.scss'],
})

export class EmployeeSelectorComponent implements OnInit, OnDestroy {
    people = [];
    selecteEmployeeId: string;

    private _ngDestroy$ = new Subject<void>();

    constructor(
        private employeesService: EmployeesService,
        private store: Store
    ) { }

    ngOnInit(): void {
        this._loadPople();
        this._loadEmployeeId();
    }

    searchEmployee(term: string, item: any) {
        if (item.firstName && item.lastName) {
            return (
                item.firstName.toLowerCase().includes(term) ||
                item.lastName.toLowerCase().includes(term)
            );
        } else if (item.firstName) {
            return item.firstName.toLowerCase().includes(term);
        } else if (item.lastName) {
            return item.lastName.toLowerCase().includes(term);
        }
    }

    selectEmployee(value: { id: string }) {
        value ? this.store.selectedEmployeeId = value.id : this.store.selectedEmployeeId = null;
    }

    getShortenedName(firstName: string, lastName: string) {
        if (firstName && lastName) {
            return firstName + ' ' + lastName[0] + '.';
        } else {
            return firstName || lastName || '[error: bad name]';
        }
    }

    getFullName(firstName: string, lastName: string) {
        return firstName && lastName
            ? firstName + ' ' + lastName
            : firstName || lastName;
    }

    private _loadEmployeeId() {
        this.store.selectedEmployeeId$
          .pipe(takeUntil(this._ngDestroy$))
          .subscribe((id: string) => {
            this.selecteEmployeeId = id;
          })
      }

    private async _loadPople() {
        const res = await this.employeesService.getAll(['user']).pipe(first()).toPromise();

        this.people = [{
            id: null,
            firstName: "All Employees",
            lastName: "",
            imageUrl: "https://i.imgur.com/XwA2T62.jpg"
        }, ...res.items.map((e) => {
            return {
                id: e.id,
                firstName: e.user.firstName,
                lastName: e.user.lastName,
                imageUrl: e.user.imageUrl
            }
        })];

        if (res.items.length > 0 && !this.store.selectedEmployeeId) {
            this.store.selectedEmployeeId = res.items[0].id
        }

        this.selectEmployee({ id: this.people[0].id })
    }

    ngOnDestroy() {
        this._ngDestroy$.next();
        this._ngDestroy$.complete();
      }
}