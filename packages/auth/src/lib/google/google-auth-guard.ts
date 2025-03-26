import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { SocialAuthService } from '../social-auth.service';

/**
 * Define a custom Google AuthGuard that checks for errors returned by Google in query params
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    constructor(public readonly service: SocialAuthService) {
        super();
    }

    canActivate(
        context: ExecutionContext
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();

        // Check for errors returned by Google in query params
        const error = request.query.error;
        if (error) {
            this.service.routeRedirect(false, { jwt: null, userId: null }, request.res, error);
            return false;
        }

        return super.canActivate(context);
    }
}
