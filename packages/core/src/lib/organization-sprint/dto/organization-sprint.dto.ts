import { IntersectionType } from '@nestjs/swagger';
import { MemberEntityBasedDTO } from '../../core/dto';
import { OrganizationSprint } from './../organization-sprint.entity';

export class OrganizationSprintDTO extends IntersectionType(OrganizationSprint, MemberEntityBasedDTO) {}
