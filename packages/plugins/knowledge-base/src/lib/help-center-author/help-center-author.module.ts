import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { HelpCenterAuthorService } from './help-center-author.service';
import { HelpCenterAuthorController } from './help-center-author.controller';
import { HelpCenterAuthor } from './help-center-author.entity';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmHelpCenterAuthorRepository } from './repository/type-orm-help-center-author.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([HelpCenterAuthor]),
		MikroOrmModule.forFeature([HelpCenterAuthor]),
		RolePermissionModule
	],
	controllers: [HelpCenterAuthorController],
	providers: [HelpCenterAuthorService, TypeOrmHelpCenterAuthorRepository, ...CommandHandlers],
	exports: [HelpCenterAuthorService, TypeOrmHelpCenterAuthorRepository]
})
export class HelpCenterAuthorModule {}
