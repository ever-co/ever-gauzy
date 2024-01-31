import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { ImportRecord } from './../../core/entities/internal';
import { MikroOrmImportRecordRepository } from './repository/mikro-orm-import-record.repository';
import { TypeOrmImportRecordRepository } from './repository/type-orm-import-record.repository';

@Injectable()
export class ImportRecordService extends TenantAwareCrudService<ImportRecord> {
	constructor(
		@InjectRepository(ImportRecord)
		readonly typeOrmImportRecordRepository: TypeOrmImportRecordRepository,

		readonly mikroOrmImportRecordRepository: MikroOrmImportRecordRepository
	) {
		super(typeOrmImportRecordRepository, mikroOrmImportRecordRepository);
	}
}
