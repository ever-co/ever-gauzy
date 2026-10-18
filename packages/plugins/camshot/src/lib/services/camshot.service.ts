import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { FileStorage, TenantAwareCrudService } from '@gauzy/core';
import { Camshot } from '../entity/camshot.entity';
import { TypeOrmCamshotRepository } from '../repositories/type-orm-camshot.repository';
import { MikroOrmCamshotRepository } from '../repositories/mikro-orm-camshot.repository';
import { FileDTO } from '../dtos/file.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IPreparedFile } from '../models/prepare.model';
import * as path from 'path';
import * as sharpModule from 'sharp';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` still returns the
// function itself: take whichever this runtime hands back.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

/**
 * The stored file's bytes as a Buffer. The local provider returns a Buffer; the S3, Wasabi and DigitalOcean
 * providers return the SDK's stream (`GetObjectCommandOutput.Body`). `undefined` when the provider returned nothing.
 */
async function toBuffer(content: unknown): Promise<Buffer | undefined> {
	if (content === null || content === undefined) return undefined;
	if (Buffer.isBuffer(content)) return content;
	if (content instanceof Uint8Array) return Buffer.from(content);
	if (typeof content === 'string') return Buffer.from(content);
	const body = content as { transformToByteArray?: () => Promise<Uint8Array> };
	if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
	if (typeof (content as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
		const chunks: Buffer[] = [];
		for await (const chunk of content as AsyncIterable<Buffer | Uint8Array | string>) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
		}
		return Buffer.concat(chunks);
	}
	return undefined;
}

@Injectable()
export class CamshotService extends TenantAwareCrudService<Camshot> {
	private readonly logger = new Logger(CamshotService.name);
	constructor(
		public readonly typeOrmCamshotRepository: TypeOrmCamshotRepository,
		public readonly mikroOrmCamshotRepository: MikroOrmCamshotRepository
	) {
		super(typeOrmCamshotRepository, mikroOrmCamshotRepository);
	}

	/**
	 * Prepare the file for the camshot service
	 * @param file - The file to prepare
	 * @returns The prepared file
	 */
	public async prepare(file: FileDTO): Promise<IPreparedFile> {
		// Get the file storage provider
		const provider = new FileStorage().getProvider();
		// Convert the plain object to a class instance
		const fileInstance = plainToInstance(FileDTO, file);
		// Validate the file DTO
		const errors = await validate(fileInstance);

		// Check for validation errors
		if (errors.length > 0) {
			// Delete the uploaded file if validation fails
			await provider.deleteFile(file.key);
			// Throw a bad request exception with the validation errors
			throw new BadRequestException(errors);
		}

		let storageProvider: FileStorageProviderEnum;
		const providerName = provider.name?.toUpperCase();
		if (providerName && Object.values(FileStorageProviderEnum).includes(providerName as FileStorageProviderEnum)) {
			storageProvider = providerName as FileStorageProviderEnum;
		} else {
			storageProvider = FileStorageProviderEnum.LOCAL;
		}
		// Create the thumbnail
		const thumbnail = await this.createThumbnail(provider, fileInstance);

		return {
			file,
			thumbnail,
			storageProvider: storageProvider ?? FileStorageProviderEnum.LOCAL
		};
	}

	public async createThumbnail(provider: any, file: FileDTO): Promise<FileDTO> {
		// Retrieve file content from the file storage provider
		const fileContent = await toBuffer(await provider.getFile(file.key));
		if (!fileContent) {
			throw new BadRequestException(`The uploaded camshot '${file.key}' could not be read back from storage`);
		}
		try {
			// 250 px wide, the height following the aspect ratio, as PNG (what the thumbnail always was). sharp
			// (libvips) resizes on its own thread pool; Jimp decoded and resized the full camshot in JavaScript on
			// the event loop, inside the upload request.
			const data = await sharp(fileContent).resize({ width: 250 }).png().toBuffer();
			// Define thumbnail file name and directory
			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.posix.dirname(file.key); // Use posix for forward slashes
			const fullPath = path.posix.join(thumbDir, thumbName);
			// Upload the thumbnail data to the file storage provider
			return provider.putFile(data, fullPath);
		} catch (error) {
			this.logger.error('Error creating thumbnail:', error);
			throw error;
		}
	}
}
