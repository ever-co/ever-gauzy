import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultUpdateRepository } from './repository/type-orm-keyresult-update.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResultUpdate]),
		MikroOrmModule.forFeature([KeyResultUpdate]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [KeyResultUpdateController],
	providers: [KeyResultUpdateService, TypeOrmKeyResultUpdateRepository, ...CommandHandlers]
})
export class KeyResultUpdateModule {}
