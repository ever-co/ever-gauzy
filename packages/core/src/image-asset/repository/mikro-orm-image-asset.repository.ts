import { EntityRepository } from '@mikro-orm/knex';
import { ImageAsset } from '../image-asset.entity';

export class MikroOrmImageAssetRepository extends EntityRepository<ImageAsset> { }
