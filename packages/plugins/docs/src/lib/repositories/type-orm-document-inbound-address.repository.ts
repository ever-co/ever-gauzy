import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentInboundAddress } from '../entities/document-inbound-address.entity';

@Injectable()
export class TypeOrmDocumentInboundAddressRepository extends Repository<DocumentInboundAddress> {
	constructor(@InjectRepository(DocumentInboundAddress) readonly repository: Repository<DocumentInboundAddress>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
