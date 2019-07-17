import { User } from '@gauzy/models';
import { Subject, BehaviorSubject } from 'rxjs';

export class Store {
    private _selectedOrganizationId: string;
    selectedOrganizationId$: BehaviorSubject<string> = new BehaviorSubject(); // TODO: FIX THIS!

    private _selectedEmployeeId: string;
    selectedEmployeeId$: Subject<string> = new Subject();

    private _selectedDate: Date;
    selectedDate$: Subject<Date> = new Subject();

    private _selectedEmployeeName: string;
    selectedEmployeeName$: Subject<string> = new Subject();

    get selectedOrganizationId(): string {
        return this._selectedOrganizationId;
    }

    set selectedEmployeeId(id: string) {
        this._selectedEmployeeId = id;
        this.selectedEmployeeId$.next(id);
    }

    get selectedEmployeeId(): string {
        return this._selectedEmployeeId;
    }

    set selectedOrganizationId(id: string) {
        this._selectedOrganizationId = id;
        this.selectedOrganizationId$.next(id);
    }

    get selectedEmployeeName() {
        return this._selectedEmployeeName;
    }

    set selectedEmployeeName(name: string) {
        this._selectedEmployeeName = name;
        this.selectedEmployeeName$.next(name);
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

    set selectedDate(date: Date) { // DATE?
        this._selectedDate = date;
        this.selectedDate$.next(date);
    }

    clear() {
        localStorage.clear();
    }
}