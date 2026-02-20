import { Injectable } from '@nestjs/common';
import { RequestContext } from '../core';
import { createToken } from '../token/shared/create-token';

export interface ICurrentUserProvider {
	getCurrentUserId(): string | null;
}

export const CURRENT_USER_PROVIDER = createToken('CurrentUserProviderToken');

@Injectable()
export class RequestContextCurrentUserProvider implements ICurrentUserProvider {
	public getCurrentUserId(): string {
		return RequestContext.currentUserId();
	}
}
