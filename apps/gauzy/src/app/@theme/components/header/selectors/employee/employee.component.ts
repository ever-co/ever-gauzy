import { Component, OnInit } from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';
import { first } from 'rxjs/operators';

@Component({
    selector: 'ga-employee-selector',
    templateUrl: './employee.component.html',
})
export class EmployeeSelectorComponent implements OnInit {
    people = [];
    selectedEmployeeId;

    constructor(
        private employeesService: EmployeesService
    ) { }

    ngOnInit(): void {
        this.loadPople();
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

    selectEmployee(event) {

    }

    getShortenedName(firstName, lastName) {
        if (firstName && lastName) {
            return firstName + ' ' + lastName[0] + '.';
        } else {
            return firstName || lastName || '[error: bad name]';
        }
    }

    getFullName(firstName, lastName) {
        return firstName && lastName
            ? firstName + ' ' + lastName
            : firstName || lastName;
    }

    private async loadPople() {
        const res = await this.employeesService.getAll(['user']).pipe(first()).toPromise();
        this.people = res.items.map((e) => e.user);
    }
}