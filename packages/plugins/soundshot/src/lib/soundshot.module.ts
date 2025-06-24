import { Module } from '@nestjs/common';
import { SoundshotController } from './soundshot.controller';
import { commandHandlers } from './commands/handlers';
import { SoundshotService } from './services/soundshot.service';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Soundshot } from './entity/soundshot.entity';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmSoundshotRepository } from './repositories/type-orm-soundshot.repository';
import { MikroOrmSoundshotRepository } from './repositories/mikro-orm-soundshot.repository';
import { RolePermissionModule } from '@gauzy/core';
import { SoundshotSubscriber } from './subscribers/soundshot.subscriber';
import { queryHandlers } from './queries';

@Module({
	controllers: [SoundshotController],
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Soundshot]),
		MikroOrmModule.forFeature([Soundshot]),
		RolePermissionModule
	],
	providers: [
		SoundshotService,
		TypeOrmSoundshotRepository,
		MikroOrmSoundshotRepository,
		SoundshotSubscriber,
		...commandHandlers,
		...queryHandlers
	],
})
export class SoundshotModule { }
