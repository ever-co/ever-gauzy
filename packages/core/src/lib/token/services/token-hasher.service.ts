import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { ITokenHasher } from '../interfaces/jwt-service.interface';

@Injectable()
export class TokenHasherService implements ITokenHasher {
	hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex');
	}
}
