import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from '../country.entity';

@Injectable()
export class TypeOrmCountryRepository extends Repository<Country> {
    constructor(@InjectRepository(Country) readonly repository: Repository<Country>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
