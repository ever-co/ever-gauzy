import {
	FileStorage,
	FileStorageFactory,
	LazyFileInterceptor,
	PaginationParams,
	RequestContext,
	UploadedFileStorage,
	UseValidationPipe
} from '@gauzy/core';
import { BadRequestException, Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPlugin } from '../../shared/models/plugin.model';
import { FileStorageProviderEnum, HttpStatus, IPagination, PluginSourceType } from '@gauzy/contracts';
import { Plugin } from '../../domain/entities/plugin.entity';
import { ListPluginsQuery } from '../../application/queries/list-plugins.query';
import { CreatePluginDTO } from '../../shared/dto/create-plugin.dto';
import { CreatePluginCommand } from '../../application/commands/create-plugin.command';
import { FileDTO } from '../../shared/dto/file.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@ApiTags('Plugin Registry')
@Controller('/plugins')
export class PluginController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({
		summary: 'Retrieve a list of plugins with optional pagination and filtering.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of plugins retrieved successfully.',
		type: Plugin,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No plugins found matching the provided criteria.'
	})
	@Get()
	public async findAll(@Query() params: PaginationParams<IPlugin>): Promise<IPagination<IPlugin>> {
		return this.queryBus.execute(new ListPluginsQuery(params));
	}

	@ApiOperation({
		summary: 'Create plugin',
		description: 'This API Endpoint allows uploading the plugin file along with related metadata.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin successfully.',
		type: Plugin
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
	})
	@ApiConsumes('multipart/form-data')
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@UseInterceptors(
		// Use LazyFileInterceptor for handling file uploads with custom storage settings
		LazyFileInterceptor('file', {
			// Define storage settings for uploaded files
			storage: () => FileStorageFactory.create('plugins')
		})
	)
	@Post()
	public async create(@Body() input: CreatePluginDTO, @UploadedFileStorage() file: FileDTO) {
		if (!file.key && input.source.type === PluginSourceType.GAUZY) {
			console.warn('Plugin file key is empty');
			return;
		}

		try {
			// Extract necessary properties from the request body
			const tenantId = input.tenantId || RequestContext.currentTenantId();
			const organizationId = input.organizationId;
			const uploadedById = input.uploadedById || RequestContext.currentEmployeeId();

			if (input.source.type === PluginSourceType.GAUZY) {
				const provider = new FileStorage().getProvider();
				// Convert the plain object to a class instance
				const fileInstance = plainToInstance(FileDTO, file);
				// Validate the file DTO
				const errors = await validate(fileInstance);

				// Check for validation errors
				if (errors.length > 0) {
					// Delete the uploaded file if validation fails
					await provider.deleteFile(file.key);
					// Throw a bad request exception with the validation errors
					throw new BadRequestException(errors);
				}
				const storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;

				// Create a new plugin record
				return this.commandBus.execute(
					new CreatePluginCommand({
						...input,
						tenantId,
						organizationId,
						uploadedById,
						source: {
							...input.source,
							fileName: file.originalname,
							fileSize: file.size,
							filePath: file.path,
							storageProvider
						}
					})
				);
			} else {
				return this.commandBus.execute(
					new CreatePluginCommand({
						...input,
						tenantId,
						organizationId,
						uploadedById
					})
				);
			}
		} catch (error) {
			// Ensure cleanup of uploaded file
			if (file?.key) {
				await new FileStorage().getProvider().deleteFile(file.key);
			}

			// Throw a bad request exception with the validation errors
			throw new BadRequestException(error);
		}
	}
}
