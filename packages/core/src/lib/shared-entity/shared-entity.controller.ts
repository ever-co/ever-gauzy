import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CommandBus } from "@nestjs/cqrs";
import { DeleteResult, FindOptionsWhere } from "typeorm";
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
        return this.withTokensForManager(await this.sharedEntityService.findAll(params));
    }

    /**
     * The number of the tenant's shares.
     *
     * Restated from the CRUD base only so it is registered before `GET /:id` below: Nest registers this class's
     * own routes before the inherited ones, so an inherited `GET /count` would be answered by `GET /:id`.
     */
    @ApiOperation({ summary: 'Get total record count' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Total record count retrieved successfully' })
    @Get('count')
    async getCount(@Query() options?: FindOptionsWhere<SharedEntity>): Promise<number> {
        return await this.sharedEntityService.countBy(options);
    }

    /**
     * The tenant's shares, a page at a time, each without its token unless the caller manages it.
     *
     * Overrides the inherited route only to drop the tokens: a share's token reads its record without signing
     * in, so a member who is neither its author nor an organization administrator must not learn it.
     */
    @ApiOperation({ summary: 'Find shared entities by page' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found shared entities', type: SharedEntity })
    @Get('pagination')
    @UseValidationPipe()
    async pagination(@Query() params?: BaseQueryDTO<SharedEntity>): Promise<IPagination<SharedEntity>> {
        return this.withTokensForManager(await this.sharedEntityService.paginate(params));
    }

    /**
     * One share, without its token unless the caller manages it (see `pagination`).
     */
    @ApiOperation({ summary: 'Find a shared entity by id' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found shared entity', type: SharedEntity })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get(':id')
    async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<SharedEntity> {
        return this.sharedEntityService.withTokenForManager(await this.sharedEntityService.findOneByIdString(id));
    }

    /** A page of shares, each without its token unless the caller manages it. */
    private withTokensForManager(page: IPagination<SharedEntity>): IPagination<SharedEntity> {
        return { ...page, items: (page?.items ?? []).map((share) => this.sharedEntityService.withTokenForManager(share)) };
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
    @UseValidationPipe({ whitelist: true })
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
    @UseValidationPipe({ whitelist: true })
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
