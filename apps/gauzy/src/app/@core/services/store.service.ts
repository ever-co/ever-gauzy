import { User } from '@gauzy/models';
import { Subject, Observable } from 'rxjs';

export class Store {
    private _selectedOrganizationId: string;
    selectedOrganizationId$: Subject<string> = new Subject();

    get selectedOrganizationId(): string {
        return this._selectedOrganizationId;
    }

    set selectedOrganizationId(id: string) {
        this._selectedOrganizationId = id;
        this.selectedOrganizationId$.next(id);
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

    clear() {
        localStorage.clear();
    }
}