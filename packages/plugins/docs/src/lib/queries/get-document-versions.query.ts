import { IQuery } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { GetDocumentVersionsQueryDTO } from '../dto/get-document-versions-query.dto';

export class GetDocumentVersionsQuery implements IQuery {
	public static readonly type = '[Document Versions] Get All';
	// Pagination only. This deliberately is NOT a `BaseQueryDTO`: that family inherits an
	// `@IsNotEmpty()` `where`, which made the route reject every request, and no code on this path
	// ever read it — the scope comes from the document named in the route.
	constructor(public readonly id: ID, public readonly params: GetDocumentVersionsQueryDTO) {}
}
