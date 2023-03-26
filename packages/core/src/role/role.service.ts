import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult, In, Not, Repository } from 'typeorm';
import { IRole, ITenant, RolesEnum, IRoleMigrateInput, IImportRecord, SYSTEM_DEFAULT_ROLES } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
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

	async createBulk(tenants: ITenant[]): Promise<IRole[] & Role[]> {
		const roles: IRole[] = [];
		const rolesNames = Object.values(RolesEnum);

		for await (const tenant of tenants) {
			for await (const name of rolesNames) {
				const role = new Role();
				role.name = name;
				role.tenant = tenant;
				role.isSystem = SYSTEM_DEFAULT_ROLES.includes(name);
				roles.push(role);
			}
		}
		return await this.roleRepository.save(roles);
	}

	async migrateRoles(): Promise<IRoleMigrateInput[]> {
		const roles: IRole[] = await this.repository.find({
			where: {
				tenantId: RequestContext.currentTenantId()
			}
		});
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
		let records: IImportRecord[] = [];
		for await (const item of roles) {
			const { isImporting, sourceId, name } = item;
			if (isImporting && sourceId) {
				const destinantion = await this.repository.findOne({
					where: {
						tenantId: RequestContext.currentTenantId(),
						name
					},
					order: {
						createdAt: 'DESC'
					}
				});
				if (destinantion) {
					records.push(
						await this._commandBus.execute(
							new ImportRecordUpdateOrCreateCommand({
								entityType: this.roleRepository.metadata.tableName,
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

	/**
	 * Few Roles can't be removed/delete for tenant
	 * RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE, RolesEnum.VIEWER, RolesEnum.CANDIDATE
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IRole['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
				name: Not(In(SYSTEM_DEFAULT_ROLES))
			}
		});
	}
}
