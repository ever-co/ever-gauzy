import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportHistory } from '../import-history.entity';

@Injectable()
export class TypeOrmImportHistoryRepository extends Repository<ImportHistory> {
    constructor(@InjectRepository(ImportHistory) readonly repository: Repository<ImportHistory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
