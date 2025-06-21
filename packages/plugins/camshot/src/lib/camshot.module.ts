import { Module } from '@nestjs/common';
import { CamshotController } from './camshot.controller';
import { commandHandlers } from './commands/handlers';
import { CamshotService } from './services/camshot.service';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Camshot } from './entity/camshot.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmCamshotRepository } from './repositories/type-orm-camshot.repository';
import { MikroOrmCamshotRepository } from './repositories/mikro-orm-camshot.repository';
import { RolePermissionModule } from '@gauzy/core';
import { CamshotSubscriber } from './subscribers/camshot.subscriber';
import { queryHandlers } from './queries';

@Module({
	controllers: [CamshotController],
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Camshot]),
		MikroOrmModule.forFeature([Camshot]),
		RolePermissionModule
	],
	providers: [
		CamshotService,
		TypeOrmCamshotRepository,
		MikroOrmCamshotRepository,
		CamshotSubscriber,
		...commandHandlers,
		...queryHandlers
	],
})
export class CamshotModule { }
