import { Controller, HttpStatus, Get, Param } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { Organization } from './organization.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { UUIDValidationPipe } from '../shared';

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
    async findAll(): Promise<IPagination<Organization>> {
        return this.organizationService.findAll();
    }

    @ApiOperation({ title: 'Find Organization by id.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found one record', type: Organization })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get(':id/:select')
    async findOneById(@Param('id', UUIDValidationPipe) id: string, @Param('select') select: string): Promise<Organization> {
        const findObj = {};
        
        if (select) {
            findObj['select'] = JSON.parse(select);
        }

        return this.organizationService.findOne(id, findObj);
    }
}