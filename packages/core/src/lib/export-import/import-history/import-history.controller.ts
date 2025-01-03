import {
    Controller,
    Get,
    HttpStatus,
    UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IImportHistory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { ImportHistoryService } from './import-history.service';

@ApiTags('Import History')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD)
@Controller()
export class ImportHistoryController {

    constructor(
        private readonly _importHistoryService: ImportHistoryService
    ) { }

    /**
     *
     * @returns
     */
    @ApiOperation({ summary: 'Find all imports history.' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Found import history'
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record not found'
    })
    @Get()
    async findAll(): Promise<IPagination<IImportHistory>> {
        return await this._importHistoryService.findAll();
    }
}
