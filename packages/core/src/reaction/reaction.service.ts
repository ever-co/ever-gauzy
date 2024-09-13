import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { UserService } from '../user/user.service';
import { Reaction } from './reaction.entity';
import { TypeOrmReactionRepository } from './repository/type-orm-reaction.repository';
import { MikroOrmReactionRepository } from './repository/mikro-orm-reaction.repository';

@Injectable()
export class ReactionService extends TenantAwareCrudService<Reaction> {
	constructor(
		readonly typeOrmReactionRepository: TypeOrmReactionRepository,
		readonly mikroOrmReactionRepository: MikroOrmReactionRepository,
		private readonly userService: UserService
	) {
		super(typeOrmReactionRepository, mikroOrmReactionRepository);
	}
}
