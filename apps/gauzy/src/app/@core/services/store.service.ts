import { User, Organization } from '@gauzy/models';
import { BehaviorSubject, Subject } from 'rxjs';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';

export class Store {
    private _selectedOrganization: Organization;
    selectedOrganization$: BehaviorSubject<Organization> = new BehaviorSubject(this.selectedOrganization);

    private _selectedEmployee: SelectedEmployee;
    selectedEmployee$: BehaviorSubject<SelectedEmployee> = new BehaviorSubject(this.selectedEmployee);

    private _selectedDate: Date;
    selectedDate$: BehaviorSubject<Date> = new BehaviorSubject(this.selectedDate);

    get selectedOrganization(): Organization {
        return this._selectedOrganization;
    }

    set selectedEmployee(employee: SelectedEmployee) {
        if (!employee) {
            employee = {
                id: null,
                firstName: "All Employees",
                lastName: '',
                imageUrl: 'https://i.imgur.com/XwA2T62.jpg'
            };
        }

        this._selectedEmployee = employee;
        this.selectedEmployee$.next(employee);
    }

    get selectedEmployee(): SelectedEmployee {
        return this._selectedEmployee;
    }

    set selectedOrganization(organization: Organization) {
        this.selectedOrganization$.next(organization);
        this._selectedOrganization = organization;
    }

    get token(): string | null {
        return localStorage.getItem('token') || null;
    }

    set token(token: string) {
        if (token == null) {
            localStorage.removeItem('token');
        } else {
            localStorage.setItem('token', token);
        }
    }

    get userId(): User['id'] | null {
        return localStorage.getItem('_userId') || null;
    }

    set userId(id: User['id'] | null) {
        if (id == null) {
            localStorage.removeItem('_userId');
        } else {
            localStorage.setItem('_userId', id);
        }
    }

    get selectedDate() {
        return this._selectedDate;
    }

    set selectedDate(date: Date) {
        this._selectedDate = date;
        this.selectedDate$.next(date);
    }

    clear() {
        localStorage.clear();
    }
}