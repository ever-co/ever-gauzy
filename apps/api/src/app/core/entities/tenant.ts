// import { TenantService } from './../../tenant/tenant.service';
// import { TenantController } from './../../tenant/tenant.controller';
// import { Base } from './base';
// import { ApiProperty } from '@nestjs/swagger';
// import { RelationId, ManyToOne, JoinColumn } from 'typeorm';
// import { Employee } from '@gauzy/models';

// export abstract class Tenant extends Base {

// 	@ApiProperty({ type: Tenant })
// 	@ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
// 	@JoinColumn()
//     tenant: Tenant;

//     @ApiProperty({ type: String, readOnly: true })
// 	@RelationId((t: T) => t.tenant )
// 	readonly tenantId?: string;
// }
