import { IIssueTypeCreateInput, IIssueTypeFindInput, IIssueTypeUpdateInput, IPaginationParam } from '@gauzy/contracts';
import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CountQueryDTO } from './../../shared/dto';
import { TenantPermissionGuard } from './../../shared/guards';
import { CrudFactory, PaginationParams } from './../../core/crud';
import { IssueType } from './issue-type.entity';
import { IssueTypeService } from './issue-type.service';
import { CreateIssueTypeDTO, UpdateIssueTypeDTO } from './dto';

@UseGuards(TenantPermissionGuard)
@ApiTags('Issue Type')
@Controller()
export class IssueTypeController extends CrudFactory<
	IssueType,
	IPaginationParam,
	IIssueTypeCreateInput,
	IIssueTypeUpdateInput,
	IIssueTypeFindInput
>(PaginationParams, CreateIssueTypeDTO, UpdateIssueTypeDTO, CountQueryDTO) {

	constructor(
		protected readonly issueTypeService: IssueTypeService
	) {
		super(issueTypeService);
	}
}
