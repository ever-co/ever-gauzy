import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	ID,
	IOrganizationStrategicSignalsUpdateInput,
	OrganizationStrategicConfidenceLevelEnum,
	OrganizationStrategicPerceivedMomentumEnum
} from '@gauzy/contracts';

/**
 * Update Organization Strategic Signals data validation request DTO
 */
export class UpdateOrganizationStrategicSignalsDTO implements IOrganizationStrategicSignalsUpdateInput {
	/**
	 * Confidence Level - Subjective confidence in strategic progress
	 */
	@ApiPropertyOptional({ type: () => String, enum: OrganizationStrategicConfidenceLevelEnum })
	@IsOptional()
	@IsEnum(OrganizationStrategicConfidenceLevelEnum)
	confidenceLevel?: OrganizationStrategicConfidenceLevelEnum;

	/**
	 * Perceived Momentum - Directional energy assessment
	 */
	@ApiPropertyOptional({ type: () => String, enum: OrganizationStrategicPerceivedMomentumEnum })
	@IsOptional()
	@IsEnum(OrganizationStrategicPerceivedMomentumEnum)
	perceivedMomentum?: OrganizationStrategicPerceivedMomentumEnum;

	/**
	 * Known Risks - Current blockers or concerns (free-text)
	 */
	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	knownRisks?: string[];

	/**
	 * Strategic Notes - Additional context or observations
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	strategicNotes?: string;

	/**
	 * Last Assessed By ID - Employee who performed the last assessment
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	lastAssessedById?: ID;
}
