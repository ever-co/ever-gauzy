import { IQuery } from '@nestjs/cqrs';

export class GetTokenByIdQuery implements IQuery {
	constructor(public readonly tokenId: string) {}
}
