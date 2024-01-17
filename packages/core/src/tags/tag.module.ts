import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { IntegrationMap } from 'core/entities/internal';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { Tag } from './tag.entity';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/tags',
				module: TagModule
			}
		]),
		TypeOrmModule.forFeature([Tag, IntegrationMap]),
		MikroOrmModule.forFeature([Tag, IntegrationMap]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [TagController],
	providers: [TagService, ...CommandHandlers],
	exports: [TagService]
})
export class TagModule { }
