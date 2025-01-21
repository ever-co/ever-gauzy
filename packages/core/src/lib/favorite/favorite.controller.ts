import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IFavorite } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from '../shared/guards';
import { CrudController, PaginationParams } from '../core/crud';
import { Favorite } from './favorite.entity';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDTO } from './dto';

@ApiTags('Favorites')
@UseGuards(TenantPermissionGuard)
@Controller('/favorite')
export class FavoriteController extends CrudController<Favorite> {
	constructor(private readonly favoriteService: FavoriteService) {
		super(favoriteService);
	}

	/**
	 * @description Mark entity element as favorite
	 * @param {IFavoriteCreateInput} entity - Data to create favorite element
	 * @returns A promise that resolves to the created or found favorite element
	 * @memberof FavoriteService
	 */
	@ApiOperation({ summary: 'Create element favorite' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateFavoriteDTO): Promise<IFavorite> {
		return await this.favoriteService.create(entity);
	}

	/**
	 * @description Find favorites by employee
	 * @param {PaginationParams<Favorite>} params Filter criteria to find favorites
	 * @returns A promise that resolves to paginated list of favorites
	 * @memberof FavoriteController
	 */
	@ApiOperation({ summary: 'Find favorite entity records By current Employee' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found favorite records',
		type: Favorite
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('/employee')
	@UseValidationPipe({ transform: true })
	async findFavoritesByEmployee(@Query() params: PaginationParams<Favorite>) {
		return await this.favoriteService.findFavoritesByEmployee(params);
	}

	/**
	 * @description Get favorites elements details
	 * @param params - Favorite query params
	 * @returns A promise resolved at favorites elements records
	 * @memberof FavoriteController
	 */
	@ApiOperation({ summary: 'Find favorite entity records.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found favorite records',
		type: Favorite
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('/type')
	@UseValidationPipe({ transform: true })
	async getFavoriteDetails(@Query() params: PaginationParams<Favorite>) {
		return await this.favoriteService.getFavoriteDetails(params);
	}

	/**
	 * @description Delete element from favorites for current employee
	 * @param {ID} id - The favorite ID to be deleted
	 * @returns  A promise that resolved at the deleteResult
	 * @memberof FavoriteController
	 */
	@ApiOperation({ summary: 'Delete Favorite' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.favoriteService.delete(id);
	}
}
