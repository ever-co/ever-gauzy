import { Controller, HttpStatus, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Changelog } from './changelog.entity';
import { ChangelogService } from './changelog.service';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('Changelog')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ChangelogController extends CrudController<Changelog> {
	constructor(private readonly changelogService: ChangelogService) {
		super(changelogService);
	}

	@ApiOperation({ summary: "What's new / Changelog." })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found changelog',
		type: Changelog
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@Get('all')
	async getAll() {
		return this.changelogService.findAll();
	}
}
