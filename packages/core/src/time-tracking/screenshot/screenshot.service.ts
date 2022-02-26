import { IScreenshot } from '@gauzy/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, Repository } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { Screenshot } from './screenshot.entity';

@Injectable()
export class ScreenshotService extends TenantAwareCrudService<Screenshot> {
	constructor(
		@InjectRepository(Screenshot)
		private readonly screenshotRepository: Repository<Screenshot>
	) {
		super(screenshotRepository);
	}

	/**
	 * DELETE screenshot by ID
	 * 
	 * @param criteria 
	 * @param options 
	 * @returns 
	 */
	async deleteScreenshot(
		criteria: string,
		options?: FindOneOptions<Screenshot>
	): Promise<IScreenshot> {
		try {
			const record = await this.findOneByIdString(criteria, options);
			
			return await this.screenshotRepository.remove(record);
		} catch (error) {
			throw new NotFoundException(`The record was not found`, error);
		}
	}
}
