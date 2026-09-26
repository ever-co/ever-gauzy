import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Entitlement } from '../entitlement.entity';

@Injectable()
export class MikroOrmEntitlementRepository extends MikroOrmBaseEntityRepository<Entitlement> {}
