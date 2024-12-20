import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import {
	IOrganizationTeamJoinRequest,
	IPagination,
	LanguagesEnum,
	OrganizationTeamJoinRequestStatusEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { PaginationParams } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { LanguageDecorator, Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OrganizationTeamJoinRequestCreateCommand } from './commands';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { ValidateJoinRequestDTO } from './dto';

@ApiTags('OrganizationTeamJoinRequest')
@Controller()
export class OrganizationTeamJoinRequestController {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService
	) {}

	/**
	 * Validate organization team join request
	 *
	 * @param params
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('validate')
	@UseValidationPipe({ whitelist: true })
	@Public()
	async validateJoinRequest(@Body() entity: ValidateJoinRequestDTO): Promise<IOrganizationTeamJoinRequest> {
		return await this._organizationTeamJoinRequestService.validateJoinRequest(entity);
	}

	/**
	 * Get organization team join requests
	 *
	 * @param params
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Get()
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW)
	@UseValidationPipe()
	async findAll(
		@Query() params: PaginationParams<OrganizationTeamJoinRequest>
	): Promise<IPagination<IOrganizationTeamJoinRequest>> {
		return await this._organizationTeamJoinRequestService.findAll(params);
	}

	/**
	 * Create organization team join request.
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe()
	@Public()
	async create(
		@Body() entity: OrganizationTeamJoinRequest,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<Object> {
		return await this._commandBus.execute(new OrganizationTeamJoinRequestCreateCommand(entity, languageCode));
	}

	/**
	 * Resend email verification code
	 *
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Post('resend-code')
	@UseValidationPipe()
	@Public()
	public async resendConfirmationCode(@Body() entity: OrganizationTeamJoinRequest): Promise<Object> {
		return await this._organizationTeamJoinRequestService.resendConfirmationCode(entity);
	}

	@Put(':id/:action')
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TEAM_JOIN_REQUEST_VIEW, PermissionsEnum.ORG_TEAM_JOIN_REQUEST_EDIT)
	public async acceptRequestToJoin(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('action') action: OrganizationTeamJoinRequestStatusEnum,
		@I18nLang() languageCode: LanguagesEnum
	) {
		return this._organizationTeamJoinRequestService.acceptRequestToJoin(id, action, languageCode);
	}
}
