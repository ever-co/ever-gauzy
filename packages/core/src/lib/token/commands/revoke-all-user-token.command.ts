import { ICommand } from '@nestjs/cqrs';

export class RevokeAllUserTokensCommand implements ICommand {
	constructor(
		public readonly userId: string,
		public readonly tokenType: string,
		public readonly revokedById?: string,
		public readonly reason?: string
	) {}
}
