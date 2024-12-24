import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../currency.entity';

@Injectable()
export class TypeOrmCurrencyRepository extends Repository<Currency> {
    constructor(@InjectRepository(Currency) readonly repository: Repository<Currency>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
