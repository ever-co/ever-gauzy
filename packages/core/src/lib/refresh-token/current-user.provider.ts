import { Injectable } from '@nestjs/common';
// The request context's own module, not the `../core` barrel: the barrel re-exports `core.module`, which
// reaches `GraphqlApiModule` and every domain module, so loading it from here (auth -> refresh-token) closed a
// require cycle in which `PaymentModule` read `EmailSendModule` while that module was still being evaluated,
// and the API failed to boot with `UndefinedModuleException`.
import { RequestContext } from '../core/context';
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
