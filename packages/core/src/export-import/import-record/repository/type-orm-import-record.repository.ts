import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportRecord } from '../import-record.entity';

@Injectable()
export class TypeOrmImportRecordRepository extends Repository<ImportRecord> {
    constructor(@InjectRepository(ImportRecord) readonly repository: Repository<ImportRecord>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
