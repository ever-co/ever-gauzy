import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { HelpCenterController } from './help-center.controller';
import { HelpCenter } from './help-center.entity';
import { HelpCenterService } from './help-center.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmHelpCenterRepository } from './repository/type-orm-help-center.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([HelpCenter]),
		MikroOrmModule.forFeature([HelpCenter]),
		RolePermissionModule
	],
	controllers: [HelpCenterController],
	providers: [HelpCenterService, TypeOrmHelpCenterRepository, ...CommandHandlers],
	exports: [HelpCenterService, TypeOrmHelpCenterRepository]
})
export class HelpCenterModule {}
