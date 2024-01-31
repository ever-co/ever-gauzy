import { Repository } from 'typeorm';
import { ImageAsset } from '../image-asset.entity';

export class TypeOrmImageAssetRepository extends Repository<ImageAsset> { }