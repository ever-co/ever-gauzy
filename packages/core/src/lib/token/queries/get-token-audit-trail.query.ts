import { IQuery } from '@nestjs/cqrs';

export class GetTokenAuditTrailQuery implements IQuery {
	constructor(public readonly tokenId: string) {}
}
