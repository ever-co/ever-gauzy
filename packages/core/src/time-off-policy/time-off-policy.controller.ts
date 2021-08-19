import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	Put,
	Param,
	HttpCode,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ITimeOffPolicyCreateInput,
	ITimeOffPolicyUpdateInput,
	ITimeOffPolicy,
	PermissionsEnum,
	IPagination
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TimeOffPolicy } from './time-off-policy.entity';
import { TimeOffPolicyService } from './time-off-policy.service';

@ApiTags('TimeOffPolicy')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TimeOffPolicyController extends CrudController<TimeOffPolicy> {
	constructor(
		private readonly timeOffPolicyService: TimeOffPolicyService
	) {
		super(timeOffPolicyService);
	}

	/**
	 * GET all time off policies
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: TimeOffPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.POLICY_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITimeOffPolicy>> {
		const { relations, findInput } = data;
		return this.timeOffPolicyService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * CREATE time off policy
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.POLICY_EDIT)
	@Post()
	async create(
		@Body() entity: ITimeOffPolicyCreateInput,
	): Promise<ITimeOffPolicy> {
		return this.timeOffPolicyService.create(entity);
	}

	/**
	 * UPDATE time off policy by id
	 * 
	 * @param id 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.POLICY_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ITimeOffPolicyUpdateInput
	): Promise<ITimeOffPolicy> {
		return this.timeOffPolicyService.update(id, entity);
	}
}
