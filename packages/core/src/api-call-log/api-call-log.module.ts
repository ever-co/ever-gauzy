import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiCallLog } from './api-call-log.entity';
import { ApiCallLogService } from './api-call-log.service';
import { TypeOrmApiCallLogRepository } from './repository/type-orm-api-call-log.repository';

@Module({
	imports: [TypeOrmModule.forFeature([ApiCallLog]), MikroOrmModule.forFeature([ApiCallLog])],
	providers: [ApiCallLogService, TypeOrmApiCallLogRepository],
	exports: [TypeOrmModule, MikroOrmModule, ApiCallLogService, TypeOrmApiCallLogRepository]
})
export class ApiCallLogModule {}
