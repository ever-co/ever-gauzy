import { IQuery } from '@nestjs/cqrs';
import { ITokenFilters } from '../interfaces/token.interface';

export class GetTokensQuery implements IQuery {
	constructor(
		public readonly filters: ITokenFilters,
		public readonly limit?: number,
		public readonly offset?: number
	) {}
}
