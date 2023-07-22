import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthRefreshGuard extends PassportAuthGuard('jwt-refresh-token') {}
