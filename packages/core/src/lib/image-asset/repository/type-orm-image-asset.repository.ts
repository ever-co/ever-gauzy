import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageAsset } from '../image-asset.entity';

@Injectable()
export class TypeOrmImageAssetRepository extends Repository<ImageAsset> {
    constructor(@InjectRepository(ImageAsset) readonly repository: Repository<ImageAsset>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
