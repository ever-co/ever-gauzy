import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { Video } from '../entities/video.entity';
import { MikroOrmVideoRepository } from '../repositories/mikro-orm-video.repository';
import { TypeOrmVideoRepository } from '../repositories/type-orm-video.repository';

@Injectable()
export class VideosService extends TenantAwareCrudService<Video> {
	constructor(
		public readonly typeOrmVideoRepository: TypeOrmVideoRepository,
		public readonly mikroOrmVideoRepository: MikroOrmVideoRepository
	) {
		super(typeOrmVideoRepository, mikroOrmVideoRepository);
	}
}
