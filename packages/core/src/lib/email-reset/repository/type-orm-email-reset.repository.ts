import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailReset } from '../email-reset.entity';

@Injectable()
export class TypeOrmEmailResetRepository extends Repository<EmailReset> {
    constructor(@InjectRepository(EmailReset) readonly repository: Repository<EmailReset>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
