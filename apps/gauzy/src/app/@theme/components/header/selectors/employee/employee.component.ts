import { Component, OnInit } from '@angular/core';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services/employees.service';

@Component({
    selector: 'ga-employee-selector',
    templateUrl: './employee.component.html',
    styleUrls: ['./employee.component.scss'],
})
export class EmployeeSelectorComponent implements OnInit{
    people = [];
    allEmployees = {
        id: "all",
        firstName: "Employees",
        lastName: "",
        imageUrl: "https://i.imgur.com/XwA2T62.jpg"
    }
    selectedEmployeeId;

    constructor(
        private employeesService: EmployeesService
    ) {}

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
        if (!event) {
            this.selectedEmployeeId = "all"
        }
        console.log(event);
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
        const res = await this.employeesService.getAll(['user']);
        this.people = [this.allEmployees, ...res.items.map((e) => e.user)];
        this.selectedEmployeeId = this.people[0].id;
    }
}