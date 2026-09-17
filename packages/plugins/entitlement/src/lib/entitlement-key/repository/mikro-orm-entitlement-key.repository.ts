import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { EntitlementKey } from '../entitlement-key.entity';

@Injectable()
export class MikroOrmEntitlementKeyRepository extends MikroOrmBaseEntityRepository<EntitlementKey> {}
