import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ApiCallLog } from './api-call-log.entity';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLogController } from './api-call-log.controller';
import { TypeOrmApiCallLogRepository } from './repository/type-orm-api-call-log.repository';

@Module({
	imports: [TypeOrmModule.forFeature([ApiCallLog]), MikroOrmModule.forFeature([ApiCallLog]), RolePermissionModule],
	controllers: [ApiCallLogController],
	providers: [ApiCallLogService, TypeOrmApiCallLogRepository],
	exports: [ApiCallLogService]
})
export class ApiCallLogModule {}
