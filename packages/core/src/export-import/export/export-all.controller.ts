import {
	Controller,
	HttpStatus,
	Get,
	Res,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ExportAllService } from './export-all.service';
import { ParseJsonPipe } from './../../shared/pipes/parse-json.pipe';
import { TenantPermissionGuard } from './../../shared/guards';

@ApiTags('Download')
@Controller()
export class ExportAllController {
	constructor(private readonly exportService: ExportAllService) {}

	@ApiOperation({ summary: 'Find all exports.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard)
	@Get()
	async exportAll(
		@Query('data', ParseJsonPipe) data: any,
		@Res() res
	): Promise<any> {
		await this.exportService.createFolders();
		await this.exportService.exportTables();
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		await this.exportService.deleteArchive();
	}

	@ApiOperation({ summary: 'Exports all tables schemas.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tables schemas'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard)
	@Get('template')
	async downloadTemplate(
		@Res() res
	): Promise<any> {
		await this.exportService.createFolders();
		await this.exportService.exportSpecificTablesSchema();
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		await this.exportService.deleteArchive();
	}

	@ApiOperation({ summary: 'Find exports by name' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found specific tables'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard)
	@Get('filter')
	async exportByName(
		@Query('data', ParseJsonPipe) data: any,
		@Res() res
	): Promise<any> {
		const { entities: { names } } = data;
		await this.exportService.createFolders();
		await this.exportService.exportSpecificTables(names);
		await this.exportService.archiveAndDownload();
		await this.exportService.downloadToUser(res);
		await this.exportService.deleteCsvFiles();
		await this.exportService.deleteArchive();
	}
}
