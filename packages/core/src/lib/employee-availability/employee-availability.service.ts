import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { IEmployeeAvailability } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../core/utils';
import { TypeOrmEmployeeAvailabilityRepository } from './repository/type-orm-employee-availability.repository';
import { MikroOrmEmployeeAvailabilityRepository } from './repository/micro-orm-employee-availability.repository';
import { EmployeeAvailability } from './employee-availability.entity';

@Injectable()
export class EmployeeAvailabilityService extends TenantAwareCrudService<EmployeeAvailability> {
	constructor(
		readonly typeOrmEmployeeAvailabilityRepository: TypeOrmEmployeeAvailabilityRepository,
		readonly mikroOrmEmployeeAvailabilityRepository: MikroOrmEmployeeAvailabilityRepository
	) {
		super(typeOrmEmployeeAvailabilityRepository, mikroOrmEmployeeAvailabilityRepository);
	}

	/**
	 * Bulk creates new employee availability records while ensuring each entity has `tenantId`.
	 * Supports both TypeORM & MikroORM.
	 *
	 * @param entities List of employee availability objects to create.
	 * @returns Promise<IEmployeeAvailability[]> List of created employee availability records.
	 */
	public async bulkCreate(entities: Partial<EmployeeAvailability>[]): Promise<IEmployeeAvailability[]> {
		const tenantId = RequestContext.currentTenantId();

		// Prepare entities ensuring `tenantId` is assigned
		const items = entities.map(entity =>
			new EmployeeAvailability({
				...entity,
				tenantId
			})
		);

		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					try {
						// Convert input entities to MikroORM format
						const mikroEntities = items.map((item: EmployeeAvailability) =>
							this.mikroOrmRepository.create(item, {
								managed: true
							})
						);

						// Bulk insert using MikroORM
						await this.mikroOrmRepository.persistAndFlush(mikroEntities);
						return mikroEntities;
					} catch (error) {
						throw new HttpException(
							`Error during MikroORM bulk create transaction : ${error.message}`,
							HttpStatus.INTERNAL_SERVER_ERROR
						);
					}

				case MultiORMEnum.TypeORM:
					try {
						// Bulk insert using TypeORM's `save` method for optimized inserts
						return await this.typeOrmRepository.save(items as DeepPartial<EmployeeAvailability>[]);
					} catch (error) {
						throw new HttpException(
							`Error during TypeORM bulk create transaction : ${error.message}`,
							HttpStatus.INTERNAL_SERVER_ERROR
						);
					}

				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}
		} catch (error) {
			throw new HttpException(
				`Error in bulkCreate method of employee availability: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
