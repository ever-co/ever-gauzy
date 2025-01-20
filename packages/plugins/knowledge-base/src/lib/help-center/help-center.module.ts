import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { HelpCenterController } from './help-center.controller';
import { HelpCenter } from './help-center.entity';
import { HelpCenterService } from './help-center.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmHelpCenterRepository } from './repository';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([HelpCenter])),
		forwardRef(() => MikroOrmModule.forFeature([HelpCenter])),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [HelpCenterController],
	providers: [HelpCenterService, TypeOrmHelpCenterRepository, ...CommandHandlers],
	exports: [HelpCenterService, TypeOrmHelpCenterRepository]
})
export class HelpCenterModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
