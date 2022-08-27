import { SetMetadata } from '@nestjs/common';
import { ROLES_METADATA } from '@gauzy/common';
import { RolesEnum } from '@gauzy/contracts';

export const Roles = (...roles: RolesEnum[]) => SetMetadata(ROLES_METADATA, roles);