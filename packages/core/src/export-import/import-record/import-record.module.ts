import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers'
import { ImportRecord } from './import-record.entity';
import { ImportRecordService } from './import-record.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		CqrsModule,
		forwardRef(() => TypeOrmModule.forFeature([ImportRecord])),
		forwardRef(() => MikroOrmModule.forFeature([ImportRecord])),
	],
	providers: [ImportRecordService, ...CommandHandlers],
	exports: [ImportRecordService]
})
export class ImportRecordModule { }
