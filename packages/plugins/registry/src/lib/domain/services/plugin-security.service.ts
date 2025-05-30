import { PluginSourceType } from '@gauzy/contracts';
import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	Logger,
	BadRequestException
} from '@nestjs/common';
import { createHash, createSign, createVerify } from 'crypto';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { PluginVersionService } from './plugin-version.service';
import { IPluginSource } from '../../shared/models/plugin-source.model';

@Injectable()
export class PluginSecurityService {
	private readonly privateKey: string;
	private readonly publicKey: string;
	private readonly logger = new Logger(PluginSecurityService.name);

	constructor(private readonly pluginVersionService: PluginVersionService) {
		// Load keys securely with proper error handling
		this.privateKey = process.env.PRIVATE_KEY?.trim();
		this.publicKey = process.env.PUBLIC_KEY?.trim();

		// Validate keys on initialization
		this.validateKeys();
	}

	/**
	 * Validates that required keys are available
	 * @private
	 */
	private validateKeys(): void {
		if (!this.privateKey || !this.publicKey) {
			this.logger.warn('Missing security keys. Cryptographic operations will fail until keys are provided.');
		}
	}

	/**
	 * Generate a SHA-256 checksum for a plugin version.
	 * @param versionId Plugin version ID
	 * @returns Hexadecimal checksum string
	 * @throws BadRequestException if versionId is missing
	 */
	public async generateChecksum(versionId: IPluginVersion['id']): Promise<string> {
		if (!versionId) {
			throw new BadRequestException('Plugin version ID is required');
		}

		const data = await this.getPluginContentForVerification(versionId);
		return this.hashData(data);
	}

	/**
	 * Generate a digital signature for a plugin version.
	 * @param versionId Plugin version ID
	 * @returns Base64-encoded signature
	 * @throws BadRequestException if versionId is missing
	 * @throws InternalServerErrorException if private key is missing
	 */
	public async generateSignature(versionId: IPluginVersion['id']): Promise<string> {
		if (!versionId) {
			throw new BadRequestException('Plugin version ID is required');
		}

		if (!this.privateKey) {
			throw new InternalServerErrorException('Private key is not configured. Cannot generate signature.');
		}

		const data = await this.getPluginContentForVerification(versionId);
		return this.signData(data);
	}

	/**
	 * Verify a digital signature for a plugin version.
	 * @param versionId Plugin version ID
	 * @param signature Base64-encoded signature
	 * @returns Boolean indicating validity
	 * @throws BadRequestException if parameters are missing or invalid
	 * @throws InternalServerErrorException if public key is missing
	 */
	public async verifySignature(versionId: IPluginVersion['id'], signature: string): Promise<boolean> {
		if (!versionId) {
			throw new BadRequestException('Plugin version ID is required');
		}

		if (!signature) {
			throw new BadRequestException('Signature is required');
		}

		if (!this.publicKey) {
			throw new InternalServerErrorException('Public key is not configured. Cannot verify signature.');
		}

		const data = await this.getPluginContentForVerification(versionId);
		return this.verifyData(data, signature);
	}

	/**
	 * Retrieves and structures plugin data into a canonical format for verification.
	 * Ensures consistent hashing by sorting object keys.
	 * @private
	 * @throws NotFoundException if plugin version or related data is not found
	 */
	private async getPluginContentForVerification(versionId: IPluginVersion['id']): Promise<string> {
		try {
			const version = await this.pluginVersionService.findOneOrFailByOptions({
				where: { id: versionId },
				relations: ['plugin', 'sources']
			});

			if (!version.success) {
				throw new NotFoundException(`Plugin version with ID ${versionId} not found.`);
			}

			if (!version.record.plugin) {
				throw new NotFoundException(`Plugin not found for version ID ${versionId}.`);
			}

			if (!version.record.sources.length) {
				throw new NotFoundException(`Plugin sources not found for plugin ID ${version.record.plugin.id}.`);
			}

			const plugin = version.record.plugin;
			const sources = version.record.sources;

			const contentObj = {
				version: version.record.number,
				name: plugin.name || '',
				type: plugin.type || '',
				sources: this.getSourceData(sources[0])
			};

			// Return a deterministically ordered JSON string
			return JSON.stringify(contentObj, Object.keys(contentObj).sort());
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			this.logger.error(`Error retrieving plugin data: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to retrieve plugin content: ${error.message}`);
		}
	}

	/**
	 * Returns a structured source object for a plugin.
	 * @private
	 * @throws InternalServerErrorException for unknown source types
	 */
	private getSourceData(source: IPluginSource): Partial<IPluginSource> {
		if (!source || !source.type) {
			throw new InternalServerErrorException('Invalid plugin source data');
		}

		try {
			switch (source.type) {
				case PluginSourceType.CDN:
					return {
						type: PluginSourceType.CDN,
						url: source.url || '',
						integrity: source.integrity || ''
					};
				case PluginSourceType.GAUZY:
					return { type: PluginSourceType.GAUZY };
				case PluginSourceType.NPM:
					return {
						type: PluginSourceType.NPM,
						name: source.name || '',
						registry: source.registry || '',
						scope: source.scope || ''
					};
				default:
					throw new InternalServerErrorException(`Unknown plugin source type: ${source.type}`);
			}
		} catch (error) {
			this.logger.error(`Error processing source data: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Hashes data using SHA-256.
	 * @private
	 * @throws InternalServerErrorException for hashing errors
	 */
	private hashData(data: string): string {
		try {
			return createHash('sha256').update(data).digest('hex');
		} catch (error) {
			this.logger.error(`Hashing error: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to hash data: ${error.message}`);
		}
	}

	/**
	 * Signs data using the private key and RSA-SHA256.
	 * @private
	 * @throws InternalServerErrorException for signing errors
	 */
	private signData(data: string): string {
		try {
			const sign = createSign('RSA-SHA256');
			sign.update(data);
			sign.end();
			return sign.sign(this.privateKey, 'base64');
		} catch (error) {
			this.logger.error(`Signing error: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to sign data: ${error.message}`);
		}
	}

	/**
	 * Verifies the signature using the public key.
	 * @private
	 * @throws InternalServerErrorException for verification errors
	 */
	private verifyData(data: string, signature: string): boolean {
		try {
			const verify = createVerify('RSA-SHA256');
			verify.update(data);
			verify.end();
			return verify.verify(this.publicKey, signature, 'base64');
		} catch (error) {
			this.logger.error(`Verification error: ${error.message}`, error.stack);
			throw new InternalServerErrorException(`Failed to verify signature: ${error.message}`);
		}
	}
}
