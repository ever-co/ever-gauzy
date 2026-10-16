import { Injectable } from '@nestjs/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';

/** Where a stored file is. */
export interface IInboxStoredFile {
	key: string;
	provider: string;
}

/**
 * Raw messages and attachments in Gauzy's FileStorage (the installation's provider: local, S3, …). The provider is
 * recorded with each file, so a later change of the default provider still reads what was stored before.
 */
@Injectable()
export class InboxEmailStorage {
	async put(content: Buffer, key: string): Promise<IInboxStoredFile> {
		const provider = new FileStorage().getProvider();
		const stored = await provider.putFile(content, key);
		return { key: stored?.key ?? key, provider: String(provider.name).toUpperCase() };
	}

	async get(file: IInboxStoredFile): Promise<Buffer> {
		const provider = new FileStorage().getProvider(file.provider as FileStorageProviderEnum);
		return provider.getFile(file.key);
	}
}
