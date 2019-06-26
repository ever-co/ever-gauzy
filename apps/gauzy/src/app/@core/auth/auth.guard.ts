import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    Router,
    RouterStateSnapshot
} from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';


@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly router: Router,
        private http: HttpClient
    ) { }

    async isAuthenticated() {
        return await this.http.get('/api/auth/authenticated').pipe(first()).toPromise();

    }

    async canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ) {
        if (await this.isAuthenticated()) {
            // logged in so return true
            return true;
        }

        // not logged in so redirect to login page with the return url
        this.router.navigate(['/auth/login'], {
            queryParams: { returnUrl: state.url }
        });

        return false;
    }
}
