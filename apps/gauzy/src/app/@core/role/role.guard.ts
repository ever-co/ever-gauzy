import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    Router,
    RouterStateSnapshot
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { first } from 'rxjs/operators';

@Injectable()
export class RoleGuard implements CanActivate {
    constructor(
        private readonly router: Router,
        private readonly authService: AuthService
    ) { }

    async canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ) {
        const expectedRole = route.data.expectedRole;
        const hasRole = await this.authService.hasRole(expectedRole).pipe(first()).toPromise();

        if (hasRole) {
            return true;
        }

        this.router.navigate(['/auth/login'], {
            queryParams: { returnUrl: state.url }
        });

        return false;
    }
}
