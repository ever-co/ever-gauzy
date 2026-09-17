import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { CommerceCheckoutSession } from '../commerce-checkout-session.entity';

@Injectable()
export class MikroOrmCommerceCheckoutSessionRepository extends MikroOrmBaseEntityRepository<CommerceCheckoutSession> {}
