import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLog } from './api-call-log.entity';

@Module({
	imports: [TypeOrmModule.forFeature([ApiCallLog]), MikroOrmModule.forFeature([ApiCallLog])],
	providers: [ApiCallLogService],
	exports: [TypeOrmModule, MikroOrmModule]
})
export class ApiCallLogModule {}
