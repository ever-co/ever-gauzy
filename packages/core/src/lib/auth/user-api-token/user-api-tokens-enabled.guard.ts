import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isUserApiTokensEnabled } from './user-api-token.utils';

/**
 * Makes the API token routes answer 404 while `GAUZY_USER_API_TOKENS_ENABLED` is off: on such a server they are not
 * there, for a stranger and for a signed-in user alike.
 */
@Injectable()
export class UserApiTokensEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!isUserApiTokensEnabled()) {
			throw new NotFoundException();
		}
		return true;
	}
}
