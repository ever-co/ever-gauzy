import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	ID,
	IEmployee,
	IEmployeePlaceholderBulkCreateResult,
	IEmployeePlaceholderMergePreview,
	IEmployeePlaceholderMergeResult,
	IInvite,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { LanguageDecorator, Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import {
	BulkCreateEmployeePlaceholderDTO,
	ClaimEmployeePlaceholderDTO,
	CreateEmployeePlaceholderDTO,
	MergeEmployeePlaceholderDTO
} from './dto/employee-placeholder.dto';
import { EmployeePlaceholderService } from './employee-placeholder.service';

/**
 * Members without an account (ever-co/ever-gauzy#11913), guarded like adding a member to an organization
 * (`ORG_EMPLOYEES_EDIT`). Every body or query names the organization, which the caller must belong to; a placeholder
 * of another organization reads as missing. A claim is accepted through the invitation routes, like any invitation.
 */
@ApiTags('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
@Controller('/employee-placeholder')
export class EmployeePlaceholderController {
	constructor(private readonly employeePlaceholderService: EmployeePlaceholderService) {}

	@ApiOperation({ summary: 'Create a member without an account: no email, no sign-in, no timer.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The member was created.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A member of the organization already has this email.' })
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() input: CreateEmployeePlaceholderDTO): Promise<IEmployee> {
		return await this.employeePlaceholderService.create(input);
	}

	@ApiOperation({ summary: 'Create many members without an account, for an import.' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'One row per member, in order: the member, and whether this call created it.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/bulk')
	@UseValidationPipe({ transform: true, whitelist: true })
	async createBulk(@Body() input: BulkCreateEmployeePlaceholderDTO): Promise<IEmployeePlaceholderBulkCreateResult> {
		return await this.employeePlaceholderService.createBulk(input);
	}

	@ApiOperation({
		summary: 'Invite the person to claim a member without an account, with a new or an existing account.'
	})
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The claim invitation was sent.' })
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'A member with an account already has this email: merge into that member instead.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/:id/claim')
	@UseValidationPipe({ transform: true, whitelist: true })
	async sendClaim(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ClaimEmployeePlaceholderDTO,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<IInvite> {
		return await this.employeePlaceholderService.sendClaim(id, input, languageCode);
	}

	@ApiOperation({ summary: 'What merging a member without an account into a member would move.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Entries, hours, timesheets, assignments, teams and overlaps.' })
	@Get('/:id/merge-preview')
	@UseValidationPipe({ transform: true, whitelist: true })
	async previewMerge(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: MergeEmployeePlaceholderDTO
	): Promise<IEmployeePlaceholderMergePreview> {
		return await this.employeePlaceholderService.previewMerge(id, query);
	}

	@ApiOperation({ summary: 'Merge a member without an account into a member of the organization with an account.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'What moved; the member without an account is removed.' })
	@HttpCode(HttpStatus.OK)
	@Post('/:id/merge')
	@UseValidationPipe({ transform: true, whitelist: true })
	async merge(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: MergeEmployeePlaceholderDTO
	): Promise<IEmployeePlaceholderMergeResult> {
		return await this.employeePlaceholderService.merge(id, input);
	}
}
