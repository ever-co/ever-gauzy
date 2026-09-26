import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { EntitlementActivation } from '../entitlement-activation.entity';

@Injectable()
export class MikroOrmEntitlementActivationRepository extends MikroOrmBaseEntityRepository<EntitlementActivation> {}
