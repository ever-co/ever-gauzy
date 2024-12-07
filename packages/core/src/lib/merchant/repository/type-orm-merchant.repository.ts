import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merchant } from '../merchant.entity';

@Injectable()
export class TypeOrmMerchantRepository extends Repository<Merchant> {
    constructor(@InjectRepository(Merchant) readonly repository: Repository<Merchant>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
