import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLogController } from './api-call-log.controller';
import { ApiCallLog } from './api-call-log.entity';
import { TypeOrmApiCallLogRepository } from './repository';

@Module({
	imports: [TypeOrmModule.forFeature([ApiCallLog]), MikroOrmModule.forFeature([ApiCallLog])],
	controllers: [ApiCallLogController],
	providers: [ApiCallLogService, TypeOrmApiCallLogRepository],
	exports: [TypeOrmModule, MikroOrmModule, ApiCallLogService, TypeOrmApiCallLogRepository]
})
export class ApiCallLogModule {}
