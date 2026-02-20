import { IQuery } from '@nestjs/cqrs';

export class GetActiveTokensQuery implements IQuery {
	constructor(public readonly userId: string, public readonly tokenType: string) {}
}
