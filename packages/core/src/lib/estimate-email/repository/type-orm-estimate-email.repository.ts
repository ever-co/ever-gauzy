import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstimateEmail } from '../estimate-email.entity';

@Injectable()
export class TypeOrmEstimateEmailRepository extends Repository<EstimateEmail> {
    constructor(@InjectRepository(EstimateEmail) readonly repository: Repository<EstimateEmail>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
