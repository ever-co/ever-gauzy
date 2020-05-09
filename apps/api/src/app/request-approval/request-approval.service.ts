import { CrudService, IPagination } from '../core';
import { RequestApproval } from './request-approval.entity';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { RequestApproval as IRequestApproval } from '@gauzy/models';

@Injectable()
export class RequestApprovalService extends CrudService<RequestApproval> {
	constructor(
		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>
	) {
		super(requestApprovalRepository);
	}
}
