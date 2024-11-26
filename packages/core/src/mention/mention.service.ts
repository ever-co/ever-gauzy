import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { TenantAwareCrudService } from './../core/crud';
import { Mention } from './mention.entity';
import { MikroOrmMentionRepository, TypeOrmMentionRepository } from './repository';

@Injectable()
export class MentionService extends TenantAwareCrudService<Mention> {
	constructor(
		readonly typeOrmMentionRepository: TypeOrmMentionRepository,
		readonly mikroOrmMentionRepository: MikroOrmMentionRepository,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmMentionRepository, mikroOrmMentionRepository);
	}
}
