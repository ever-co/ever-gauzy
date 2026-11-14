import { ICommand } from '@nestjs/cqrs';

/** Records that the user signed `sessionId` out, until `expiresAt` (see `session-sign-out-marker.ts`). */
export class MarkSessionSignedOutCommand implements ICommand {
	constructor(
		public readonly userId: string,
		public readonly sessionId: string,
		public readonly expiresAt: Date,
		public readonly reason: string
	) {}
}
