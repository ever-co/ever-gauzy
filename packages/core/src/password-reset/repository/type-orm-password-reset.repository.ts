import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordReset } from '../password-reset.entity';

@Injectable()
export class TypeOrmPasswordResetRepository extends Repository<PasswordReset> {
    constructor(@InjectRepository(PasswordReset) readonly repository: Repository<PasswordReset>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
