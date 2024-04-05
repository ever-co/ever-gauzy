import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomSmtp } from '../custom-smtp.entity';

@Injectable()
export class TypeOrmCustomSmtpRepository extends Repository<CustomSmtp> {
    constructor(@InjectRepository(CustomSmtp) readonly repository: Repository<CustomSmtp>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
