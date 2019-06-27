import { Controller, HttpStatus, Get } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';

@ApiUseTags('Organization')
@Controller()
export class OrganizationController extends CrudController<Organization> {
    constructor(private readonly organizationService: OrganizationService) {
        super(organizationService);
    }

    @ApiOperation({ title: 'Find all organizations.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found organizations', type: Organization })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(): Promise<IPagination<Organization>> {
        return this.organizationService.findAll();
    }
}