import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { getManager, Repository } from 'typeorm';
import { IRole, ITenant, RolesEnum, IRoleMigrateInput, IImportRecord } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { Role } from './role.entity';
import { RequestContext } from './../core/context';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';

@Injectable()
export class RoleService extends TenantAwareCrudService<Role> {
	constructor(
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,

		private readonly _commandBus: CommandBus
	) {
		super(roleRepository);
	}

	async createBulk(tenants: ITenant[]): Promise<IRole[]> {
		const roles: IRole[] = [];
		const rolesNames = Object.values(RolesEnum);
		
		for await (const tenant of tenants) {
			for await (const name of rolesNames) {
				const role = new Role();
				role.name = name;
				role.tenant = tenant;
				roles.push(role);
			}
		}
		await this.roleRepository.save(roles);
		return roles;
	}

	async migrateRoles(): Promise<IRoleMigrateInput[]> {
		const roles: IRole[] = await this.repository.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			}
		})
		const payload: IRoleMigrateInput[] = []; 
		for await (const item of roles) {
			const { id: sourceId, name } = item;
			payload.push({
				name,
				isImporting: true,
				sourceId 
			})
		}
		return payload;
	}

	async migrateImportRecord(roles: IRoleMigrateInput[]) {
		console.log(roles);
		let records: IImportRecord[] = [];
		if (roles.length > 0) {
			for await (const item of roles) {
				const { isImporting, sourceId, name } = item;
				if (isImporting && sourceId) {
					const destinantion = await this.roleRepository.findOne({
						tenantId: RequestContext.currentTenantId(),
						name
					}, { order: { createdAt: 'DESC' }});
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: getManager().getRepository(Role).metadata.tableName,
								sourceId,
								destinationId: destinantion.id,
								tenantId: RequestContext.currentTenantId()
							})
						)
					);
				}
			}
		}
		return records;
	}
}
