import { Component } from '@angular/core';

@Component({
    selector: 'ea-employee-selector',
    templateUrl: './employee.component.html',
})
export class EmployeeSelectorComponent {
    people = [
        {
            id: 'all',
            firstName: 'Employees',
            avatar: 'https://files.slack.com/files-pri/T0BBDDG2G-FKDK1Q2LB/all.jpg'
        },
        {
            id: 'd9203kr3kf3wf3d3d3',
            firstName: 'Emil',
            lastName: 'Momchilov',
            avatar: 'https://www.w3schools.com/howto/img_avatar.png'
        },
        {
            id: '232d2domd039023',
            firstName: 'Someone',
            lastName: 'Someoneton',
            avatar: 'https://www.w3schools.com/howto/img_avatar.png'
        },
        {
            id: '8d932h9d823hf2',
            firstName: 'Boyan',
            lastName: 'Stanchev',
            avatar: 'https://www.w3schools.com/howto/img_avatar.png'
        }
    ];

    selectedEmployeeId = 'all';


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
        if (event === undefined) {
            this.selectedEmployeeId = 'all';
        }
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
}