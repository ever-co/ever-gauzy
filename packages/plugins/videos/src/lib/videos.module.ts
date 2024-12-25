import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { CommandHandlers } from './commands/handlers';
import { Video } from './entities/video.entity';
import { VideoSubscriber } from './subscribers/video.subscriber';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmVideoRepository } from './repositories/type-orm-video.repository';
import { VideosService } from './services/videos.service';
import { VideosController } from './videos.controller';

@Module({
	controllers: [VideosController],
	imports: [TypeOrmModule.forFeature([Video]), MikroOrmModule.forFeature([Video]), RolePermissionModule, CqrsModule],
	providers: [VideosService, VideoSubscriber, TypeOrmVideoRepository, ...CommandHandlers, ...QueryHandlers],
	exports: [VideosService]
})
export class VideosModule { }
