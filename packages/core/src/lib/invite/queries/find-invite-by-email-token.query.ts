import { IQuery } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { Invite } from './../../core/entities/internal';

export class FindInviteByEmailTokenQuery implements IQuery {

	constructor(
		public readonly params: FindOptionsWhere<Invite>
	) {}
}