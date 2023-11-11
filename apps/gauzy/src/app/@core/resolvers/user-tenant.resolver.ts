import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve } from "@angular/router";
import { catchError, debounceTime, from, of } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import { ErrorHandlingService, UsersService } from "../services";

@Injectable({
    providedIn: 'root'
})
export class UserTenantResolver implements Resolve<Observable<number | Observable<never>>> {
    constructor(
        private readonly _usersService: UsersService,
        private readonly _errorHandlingService: ErrorHandlingService,
    ) { }

    // Get the observable for fetching user data from the service
    resolve(
        route: ActivatedRouteSnapshot
    ): Observable<number> {
        // Get the observable for fetching user data from the service
        const user$ = this._usersService.getMe(['tenant']);

        // Pipe operators to process the observable stream
        return from(user$).pipe(
            debounceTime(100), // Add a debounceTime to wait for a specified time before emitting the latest value
            // Catch and handle errors
            catchError((error) => {
                // Handle and log errors using the _errorHandlingService
                this._errorHandlingService.handleError(error);
                // Return an empty observable to continue the stream
                return of(error);
            }),
        );
    }
}
