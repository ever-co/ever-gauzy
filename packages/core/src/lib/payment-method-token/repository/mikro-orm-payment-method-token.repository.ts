import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { PaymentMethodToken } from '../payment-method-token.entity';

/**
 * MikroORM repository of PaymentMethodToken. The base class supplies the entity-manager-backed
 * operations the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmPaymentMethodTokenRepository extends MikroOrmBaseEntityRepository<PaymentMethodToken> {}
