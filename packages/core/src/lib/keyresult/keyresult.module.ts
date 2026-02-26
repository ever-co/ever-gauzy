import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';
import { KeyResultController } from './keyresult.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultRepository } from './repository/type-orm-keyresult.repository';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResult]),
		MikroOrmModule.forFeature([KeyResult]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [KeyResultController],
	providers: [KeyResultService, TypeOrmKeyResultRepository, MikroOrmKeyResultRepository]
})
export class KeyResultModule {}