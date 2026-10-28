import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { AccountDeletionRequest } from '../account-deletion-request.entity';

export class MikroOrmAccountDeletionRequestRepository extends MikroOrmBaseEntityRepository<AccountDeletionRequest> {}
