import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { commandHandlers } from './commands/handlers';
import { Video } from './entities/video.entity';
import { queryHandlers } from './queries/handlers';
import { TypeOrmVideoRepository } from './repositories/type-orm-video.repository';
import { VideosService } from './services/videos.service';
import { VideosController } from './videos.controller';

@Module({
	controllers: [VideosController],
	imports: [TypeOrmModule.forFeature([Video]), MikroOrmModule.forFeature([Video]), RolePermissionModule, CqrsModule],
	providers: [VideosService, TypeOrmVideoRepository, ...commandHandlers, ...queryHandlers],
	exports: [VideosService]
})
export class VideosModule { }
