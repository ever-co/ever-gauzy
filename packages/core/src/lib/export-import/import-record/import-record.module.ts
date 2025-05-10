import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { ImportRecord } from './import-record.entity';
import { ImportRecordService } from './import-record.service';
import { TypeOrmImportRecordRepository } from './repository/type-orm-import-record.repository';

@Module({
	imports: [CqrsModule, TypeOrmModule.forFeature([ImportRecord]), MikroOrmModule.forFeature([ImportRecord])],
	providers: [ImportRecordService, TypeOrmImportRecordRepository, ...CommandHandlers],
	exports: [ImportRecordService]
})
export class ImportRecordModule {}
