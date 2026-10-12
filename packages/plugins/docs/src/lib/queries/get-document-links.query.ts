import { IQuery } from '@nestjs/cqrs';
import { BaseEntityEnum, ID } from '@gauzy/contracts';

/**
 * Serves both link list directions: by business record (`entity` + `entityId`) or by document
 * (`documentId`).
 */
export class GetDocumentLinksQuery implements IQuery {
	public static readonly type = '[Document Links] Get All';
	constructor(
		public readonly filter: { entity?: BaseEntityEnum; entityId?: ID; documentId?: ID; organizationId?: ID }
	) {}
}
