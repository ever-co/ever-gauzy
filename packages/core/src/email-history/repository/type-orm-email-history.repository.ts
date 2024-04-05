import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailHistory } from '../email-history.entity';

@Injectable()
export class TypeOrmEmailHistoryRepository extends Repository<EmailHistory> {
    constructor(@InjectRepository(EmailHistory) readonly repository: Repository<EmailHistory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
