import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CommandBus } from "@nestjs/cqrs";
import { DeleteResult } from "typeorm";
import { Public } from "@gauzy/common";
import { ID, IPagination } from "@gauzy/contracts";
import { UseValidationPipe, UUIDValidationPipe } from "../shared/pipes";
import { TenantPermissionGuard } from "../shared/guards";
import { BaseQueryDTO, CrudController } from "../core/crud";
import { SharedEntity } from "./shared-entity.entity";
import { SharedEntityService } from "./shared-entity.service";
import { SharedEntityCreateCommand, SharedEntityUpdateCommand } from "./commands";
import { CreateSharedEntityDTO, UpdateSharedEntityDTO } from "./dto";

@ApiTags('SharedEntity')
@UseGuards(TenantPermissionGuard)
@Controller('/shared-entities')
export class SharedEntityController extends CrudController<SharedEntity> {
    constructor(
        private readonly sharedEntityService: SharedEntityService,
        private readonly commandBus: CommandBus
    ) {
        super(sharedEntityService);
    }

    @ApiOperation({
        summary: 'Find all shared entities'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Found shared entities',
        type: SharedEntity
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record not found'
    })
    @Get()
    @UseValidationPipe()
    async findAll(@Query() params: BaseQueryDTO<SharedEntity>): Promise<IPagination<SharedEntity>> {
        return await this.sharedEntityService.findAll(params);
    }

    @ApiOperation({
        summary: 'Get a shared entity by token'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Found shared entity',
        type: SharedEntity
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Record not found'
    })
    @Public()
    @HttpCode(HttpStatus.OK)
    @Get('/token/:token')
    @UseValidationPipe()
    async getSharedEntityByToken(@Param('token') token: string): Promise<any> {
        return await this.sharedEntityService.getSharedEntityByToken(token);
    }

    @ApiOperation({
        summary: 'Create a new shared entity'
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Shared entity created successfully',
        type: SharedEntity
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input, The response body may contain clues as to what went wrong'
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    @UseValidationPipe()
    async create(@Body() entity: CreateSharedEntityDTO): Promise<SharedEntity> {
        return await this.commandBus.execute(new SharedEntityCreateCommand(entity));
    }

    @ApiOperation({
        summary: 'Update a shared entity'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Shared entity updated successfully',
        type: SharedEntity
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input, The response body may contain clues as to what went wrong'
    })
    @HttpCode(HttpStatus.OK)
    @Put(':id')
    @UseValidationPipe()
    async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateSharedEntityDTO): Promise<SharedEntity> {
        return await this.commandBus.execute(new SharedEntityUpdateCommand(id, entity));
    }

    @ApiOperation({
        summary: 'Delete a shared entity'
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Shared entity deleted successfully'
    })
    @HttpCode(HttpStatus.OK)
    @Delete(':id')
    async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
        return await this.sharedEntityService.delete(id);
    }
}
