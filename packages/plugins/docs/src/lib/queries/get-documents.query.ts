import { IQuery } from '@nestjs/cqrs';
import { GetDocumentsQueryDTO } from '../dto';

export class GetDocumentsQuery implements IQuery {
	public static readonly type = '[Documents] Get All';
	constructor(public readonly params: GetDocumentsQueryDTO) {}
}
