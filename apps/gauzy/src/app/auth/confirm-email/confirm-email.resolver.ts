import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { catchError, Observable, of as observableOf } from 'rxjs';
import { IEstimateEmail } from '@gauzy/contracts';
import { AuthService } from '../../@core/services';

@Injectable({
    providedIn: 'root'
})
export class ConfirmEmailResolver implements Resolve<Observable<Object | Observable<never>>> {
    constructor(
        private readonly authService: AuthService
    ) {}

    resolve(
        route: ActivatedRouteSnapshot
    ): Observable<IEstimateEmail | Observable<never>> {
        const token = route.queryParamMap.get('token');
        const email = route.queryParamMap.get('email');
        return this.authService.confirmEmail({
            email,
            token
        }).pipe(
            catchError((error) => {
                console.log('Handling error locally and rethrowing it...', error);
                return observableOf(error);
            })
        );
    }
}