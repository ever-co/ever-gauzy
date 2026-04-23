import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { IOfficialHoliday } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';

/**
 * Stores nationally/officially recognized holidays per country.
  *
   * These records are used in the Time-Off module to pre-populate
    * the "Add Holidays" dialog with correct from/to dates when an admin
     * selects a known holiday name.
      *
       * Issue: https://github.com/ever-co/ever-gauzy/issues/314
        */
        @Entity('official_holiday')
        export class OfficialHoliday
        	extends TenantOrganizationBaseEntity
          	implements IOfficialHoliday {

            	// ─── Name ─────────────────────────────────────────────────────────────────

              	@ApiProperty({ type: () => String, description: 'Display name of the holiday, e.g. "Christmas Day"' })
                	@IsNotEmpty()
                  	@IsString()
                    	@Length(2, 200)
                      	@Index()
                        	@Column()
                          	name: string;

                            	// ─── Country Code ─────────────────────────────────────────────────────────

                              	@ApiProperty({ type: () => String, description: 'ISO 3166-1 alpha-2 country code (e.g. "US", "DE")' })
                                	@IsNotEmpty()
                                  	@IsString()
                                    	@Length(2, 2)
                                      	@Index()
                                        	@Column({ length: 2 })
                                          	countryCode: string;

                                            	// ─── Date ─────────────────────────────────────────────────────────────────

                                              	@ApiProperty({ type: () => Date, description: 'Holiday date or start date for multi-day holidays' })
                                                	@IsNotEmpty()
                                                  	@IsDate()
                                                    	@Column()
                                                      	date: Date;

                                                        	// ─── End Date ─────────────────────────────────────────────────────────────

                                                          	@ApiPropertyOptional({ type: () => Date, description: 'End date for multi-day holidays' })
                                                            	@IsOptional()
                                                              	@IsDate()
                                                                	@Column({ nullable: true })
                                                                  	endDate?: Date;

                                                                    	// ─── Recurring ────────────────────────────────────────────────────────────

                                                                      	@ApiPropertyOptional({
                                                                        		type: () => Boolean,
                                                                            		description: 'Whether this holiday recurs every year on the same date'
                                                                                	})
                                                                                  	@IsOptional()
                                                                                    	@IsBoolean()
                                                                                      	@Column({ default: true })
                                                                                        	isRecurring?: boolean;
                                                                                          }
