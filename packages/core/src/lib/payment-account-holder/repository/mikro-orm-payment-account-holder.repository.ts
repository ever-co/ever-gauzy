import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PaymentAccountHolder } from '../payment-account-holder.entity';

/**
 * MikroORM repository of PaymentAccountHolder. The base class supplies the entity-manager-backed
 * operations the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentAccountHolderRepository extends MikroOrmBaseEntityRepository<PaymentAccountHolder> {}
