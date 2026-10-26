import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, RolesEnum } from '@gauzy/contracts';
import { BaseQueryDTO } from './../core/crud';
import { Roles } from '../shared/decorators';
import { RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { CreateReportCategoryDTO, UpdateReportCategoryDTO } from './dto';
import { ReportCategory } from './report-category.entity';
import { ReportCategoryService } from './report-category.service';

@ApiTags('Report Category')
@Controller('/report/category')
export class ReportCategoryController {
	constructor(private reportCategoryService: ReportCategoryService) {}

	@ApiOperation({ summary: 'Find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get('/')
	async findAll(@Query() filter?: BaseQueryDTO<ReportCategory>): Promise<IPagination<ReportCategory>> {
		return this.reportCategoryService.findAll(filter);
	}

	/**
	 * Files one heading of the platform-wide report catalogue.
	 *
	 * The catalogue has no tenant — a row here is offered to every tenant — so the route is gated to
	 * `SUPER_ADMIN` by role, under the tenant guard that checks the credential's tenant first.
	 */
	@ApiOperation({ summary: 'Create a report category (SUPER_ADMIN).' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The category.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller is not a SUPER_ADMIN.' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(TenantPermissionGuard, RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() input: CreateReportCategoryDTO): Promise<ReportCategory> {
		return this.reportCategoryService.createCategory(input);
	}

	/**
	 * Edits one heading of the catalogue. A member left out is left as it is.
	 */
	@ApiOperation({ summary: 'Update a report category (SUPER_ADMIN).' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The category as it now stands.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No such category.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller is not a SUPER_ADMIN.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(TenantPermissionGuard, RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateReportCategoryDTO
	): Promise<ReportCategory> {
		return this.reportCategoryService.updateCategory(id, input);
	}

	/**
	 * Withdraws one heading of the catalogue: a soft delete, refused while a live report is filed under it.
	 * Answers whether a live category was withdrawn — `false` for one that is not there.
	 */
	@ApiOperation({ summary: 'Withdraw (soft-delete) a report category (SUPER_ADMIN).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Whether a live category was withdrawn.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A live report is still filed under it.' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The caller is not a SUPER_ADMIN.' })
	@HttpCode(HttpStatus.OK)
	@UseGuards(TenantPermissionGuard, RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<boolean> {
		return this.reportCategoryService.withdrawCategory(id);
	}
}
