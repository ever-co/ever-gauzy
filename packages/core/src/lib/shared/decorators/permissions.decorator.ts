import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_METADATA } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';

export const Permissions = (...permissions: PermissionsEnum[]) => SetMetadata(PERMISSIONS_METADATA, permissions);
