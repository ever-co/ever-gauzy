/*
 *  Approval Policy is predefined approval types for the organization.
 * E.g. for example, "Business Trip", "Borrow Items", ...
 * Approval Policy table has the many to one relationship to the Organization table and Tenant by organizationId and tenantId
 */
import { IEquipmentSharing, IEquipmentSharingPolicy } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { EquipmentSharing, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMOneToMany } from './../core/decorators/entity';
import { MikroOrmEquipmentSharingPolicyRepository } from './repository/mikro-orm-equipment-sharing-policy.repository';

@MultiORMEntity('equipment_sharing_policy', { mikroOrmRepository: () => MikroOrmEquipmentSharingPolicyRepository })
export class EquipmentSharingPolicy extends TenantOrganizationBaseEntity implements IEquipmentSharingPolicy {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	description: string;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * EquipmentSharing
	 */
	@MultiORMOneToMany(() => EquipmentSharing, (it) => it.equipmentSharingPolicy, {
		onDelete: 'CASCADE'
	})
	equipmentSharings?: IEquipmentSharing[];
}
