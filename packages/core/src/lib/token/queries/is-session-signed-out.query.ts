import { IQuery } from '@nestjs/cqrs';

/** Whether the user signed `sessionId` out (see `session-sign-out-marker.ts`). */
export class IsSessionSignedOutQuery implements IQuery {
	constructor(
		public readonly userId: string,
		public readonly sessionId: string
	) {}
}
