import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGaurd } from '@nestjs/passport';

@Injectable()
export class AuthRefreshGuard extends PassportAuthGaurd('jwt-refresh-token') {}