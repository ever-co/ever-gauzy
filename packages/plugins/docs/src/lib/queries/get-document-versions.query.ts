import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { DocumentVersion } from '../entities/document-version.entity';

export class GetDocumentVersionsQuery implements IQuery {
	public static readonly type = '[Document Versions] Get All';
	constructor(public readonly id: ID, public readonly params: BaseQueryDTO<DocumentVersion>) {}
}
