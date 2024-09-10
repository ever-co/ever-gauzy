import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FavoriteTypeEnum, IFavorite, PermissionsEnum } from '@gauzy/contracts';
import { UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Permissions } from '../shared/decorators';
import { CrudController } from '../core/crud';
import { Favorite } from './favorite.entity';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDTO } from './dto';

@ApiTags('Favorites')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD)
@Controller()
export class FavoriteController extends CrudController<Favorite> {
	constructor(private readonly favoriteService: FavoriteService) {
		super(favoriteService);
	}

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
	async getEmployeeProjectModules(@Query('type') favoritableType: FavoriteTypeEnum) {
		return await this.favoriteService.getFavoriteDetails(favoritableType);
	}
}
