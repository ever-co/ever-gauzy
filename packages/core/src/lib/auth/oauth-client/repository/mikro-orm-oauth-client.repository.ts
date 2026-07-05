/**
 * MikroORM repository for the multi-app OAuth client registry.
 *
 * Empty subclass of `MikroOrmBaseEntityRepository` — same pattern as
 * `MikroOrmTokenRepository`. Provides the MikroORM half of the dual-ORM
 * pair consumed by `TenantAwareCrudService`.
 */
import { MikroOrmBaseEntityRepository } from '../../../core/repository/mikro-orm-base-entity.repository';
import { OAuthClient } from '../oauth-client.entity';

export class MikroOrmOAuthClientRepository extends MikroOrmBaseEntityRepository<OAuthClient> {}
