
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyResult } from '../keyresult.entity';

@Injectable()
export class TypeOrmKeyResultRepository extends Repository<KeyResult> {
    constructor(@InjectRepository(KeyResult) readonly repository: Repository<KeyResult>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
