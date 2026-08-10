import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { DocumentInboundAddress } from '../entities/document-inbound-address.entity';

export class MikroOrmDocumentInboundAddressRepository extends MikroOrmBaseEntityRepository<DocumentInboundAddress> {}
