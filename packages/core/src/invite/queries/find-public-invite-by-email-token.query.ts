import { IQuery } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { Invite } from './../../core/entities/internal';

export class FindPublicInviteByEmailTokenQuery implements IQuery {

	constructor(
		public readonly params: FindOptionsWhere<Invite>
	) {}
}