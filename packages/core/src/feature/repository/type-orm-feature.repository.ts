import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature } from '../feature.entity';

@Injectable()
export class TypeOrmFeatureRepository extends Repository<Feature> {
    constructor(@InjectRepository(Feature) readonly repository: Repository<Feature>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
