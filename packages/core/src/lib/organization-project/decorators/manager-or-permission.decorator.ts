import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { ProjectManagerOrPermissionGuard } from '../guards/project-manager-or-permission.guard';

export const ManagerOrPermissions = (...permissions: PermissionsEnum[]) =>
	applyDecorators(SetMetadata(PERMISSIONS_METADATA, permissions), UseGuards(ProjectManagerOrPermissionGuard));
