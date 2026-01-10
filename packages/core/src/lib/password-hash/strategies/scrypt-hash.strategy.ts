import { Injectable } from '@nestjs/common';
import { hashPassword, verifyPassword } from '@gauzy/utils';
import { IPasswordHashStrategy } from '../interfaces';

@Injectable()
export class ScryptHashStrategy implements IPasswordHashStrategy {
	private readonly ALGORITHM_PREFIX = '$scrypt$';

	async hash(password: string): Promise<string> {
		return hashPassword(password);
	}

	async verify(password: string, hashedPassword: string): Promise<boolean> {
		return verifyPassword(password, hashedPassword);
	}

	getAlgorithmIdentifier(): string {
		return 'scrypt';
	}

	canVerify(hashedPassword: string): boolean {
		return hashedPassword?.startsWith(this.ALGORITHM_PREFIX) ?? false;
	}
}
