import { IntersectionType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IJobPreset } from '@gauzy/contracts';

/**
 * Data Transfer Object for creating job presets.
 */
export class CreateJobPresetDTO extends IntersectionType(TenantOrganizationBaseDTO) implements IJobPreset {}
