import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ITimesheetProjectChangeRequest, TimesheetProjectChangeStatus } from '@gauzy/contracts';
import { OrganizationProject } from '../../organization-project/organization-project.entity';
import { TenantOrganizationBaseEntity } from './../../core/entities/internal';
import { Timesheet } from './timesheet.entity';
import { User } from '../../user/user.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';

@MultiORMEntity('timesheet_project_change_request', { mikroOrmRepository: () => require('./repository/mikro-orm-timesheet-project-change-request.repository').MikroOrmTimesheetProjectChangeRequestRepository })
export class TimesheetProjectChangeRequest extends TenantOrganizationBaseEntity implements ITimesheetProjectChangeRequest {
	@ApiProperty({ type: () => String })
  	@IsNotEmpty()
    	@IsUUID()
      	@ColumnIndex()
        	@MultiORMColumn()
          	timesheetId: string;

            	@ApiProperty({ type: () => String })
              	@IsNotEmpty()
                	@IsUUID()
                  	@ColumnIndex()
                    	@MultiORMColumn()
                      	requestedProjectId: string;

                        	@ApiPropertyOptional({ type: () => String })
                          	@IsOptional()
                            	@IsUUID()
                              	@ColumnIndex()
                                	@MultiORMColumn({ nullable: true })
                                  	previousProjectId?: string;

                                    	@ApiProperty({ type: () => String })
                                      	@IsNotEmpty()
                                        	@IsString()
                                          	@MultiORMColumn()
                                            	reason: string;

                                              	@ApiProperty({ enum: TimesheetProjectChangeStatus })
                                                	@IsEnum(TimesheetProjectChangeStatus)
                                                  	@ColumnIndex()
                                                    	@MultiORMColumn({ type: 'varchar', default: TimesheetProjectChangeStatus.PENDING })
                                                      	status: TimesheetProjectChangeStatus;

                                                        	@ApiPropertyOptional({ type: () => String })
                                                          	@IsOptional()
                                                            	@IsUUID()
                                                              	@ColumnIndex()
                                                                	@MultiORMColumn({ nullable: true })
                                                                  	reviewedById?: string;

                                                                    	@ApiPropertyOptional({ type: () => Date })
                                                                      	@IsOptional()
                                                                        	@MultiORMColumn({ type: 'datetime', nullable: true })
                                                                          	reviewedAt?: Date;

                                                                            	@ApiPropertyOptional({ type: () => String })
                                                                              	@IsOptional()
                                                                                	@IsString()
                                                                                  	@MultiORMColumn({ nullable: true })
                                                                                    	reviewNote?: string;

                                                                                      	// @ManyToOne Relations
                                                                                        	@MultiORMManyToOne(() => Timesheet, { onDelete: 'CASCADE' })
                                                                                          	timesheet?: Timesheet;

                                                                                            	@MultiORMManyToOne(() => OrganizationProject, { nullable: true })
                                                                                              	requestedProject?: OrganizationProject;

                                                                                                	@MultiORMManyToOne(() => OrganizationProject, { nullable: true })
                                                                                                  	previousProject?: OrganizationProject;
                                                                                                    
                                                                                                    	@MultiORMManyToOne(() => User, { nullable: true })
                                                                                                      	reviewedBy?: User;
                                                                                                        }
