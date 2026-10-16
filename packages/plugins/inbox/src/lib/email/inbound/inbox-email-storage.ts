import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';

/** Where a stored file is. */
export interface IInboxStoredFile {
	key: string;
	provider: string;
}

/** A stored file's content as the providers answer it — a Buffer, bytes, text or a stream (S3 and co.) — as a Buffer. */
export async function toBuffer(content: unknown): Promise<Buffer> {
	if (content === undefined || content === null) throw new Error('The stored file could not be read.');
	if (Buffer.isBuffer(content)) return content;
	if (content instanceof Uint8Array) return Buffer.from(content);
	if (typeof content === 'string') return Buffer.from(content);
	const body = content as {
		transformToByteArray?: () => Promise<Uint8Array>;
		[Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
	};
	if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
	if (typeof body[Symbol.asyncIterator] === 'function') {
		const chunks: Buffer[] = [];
		for await (const chunk of content as AsyncIterable<unknown>) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
		}
		return Buffer.concat(chunks);
	}
	throw new Error('The stored file has a form this storage cannot read.');
}

/** The provider name recorded for files kept in the Inbox's own private local directory. */
export const INBOX_LOCAL_PROVIDER = 'INBOX_LOCAL';

/**
 * The private directory email files are kept in when the installation stores files locally: Gauzy's local provider
 * writes under the API's public asset root (served without authentication), which is no place for mail.
 * `GAUZY_INBOX_LOCAL_STORAGE_PATH`, else `<working directory>/storage/inbox` (put it on a persistent volume).
 */
export function inboxLocalRoot(env: Record<string, string | undefined> = process.env): string {
	const configured = (env['GAUZY_INBOX_LOCAL_STORAGE_PATH'] ?? '').trim();
	return resolve(configured || resolve(process.cwd(), 'storage', 'inbox'));
}

/**
 * Raw messages and attachments. With a remote provider (S3, Wasabi, DigitalOcean, Cloudinary) they go to Gauzy's
 * FileStorage under the message's tenant; with the local provider, to the Inbox's private directory instead (never the
 * public asset root), its folders created as needed. The provider is recorded with each file, so a later change of the
 * default provider still reads what was stored before. Email files are only ever served through the checked download
 * routes; no storage URL is answered by any route.
 */
@Injectable()
export class InboxEmailStorage {
	async put(content: Buffer, key: string): Promise<IInboxStoredFile> {
		const provider = new FileStorage().getProvider();
		if (String(provider.name).toUpperCase() === FileStorageProviderEnum.LOCAL) {
			const path = this.localPath(key);
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, content);
			return { key, provider: INBOX_LOCAL_PROVIDER };
		}
		const stored = await provider.putFile(content, key);
		// The remote providers answer nothing (rather than throwing) when an upload fails: that is a failure here.
		if (!stored?.key) throw new Error('The file could not be stored.');
		return { key: stored.key, provider: String(provider.name).toUpperCase() };
	}

	async get(file: IInboxStoredFile): Promise<Buffer> {
		if (file.provider === INBOX_LOCAL_PROVIDER) {
			return readFile(this.localPath(file.key));
		}
		const provider = new FileStorage().getProvider(file.provider as FileStorageProviderEnum);
		return toBuffer(await provider.getFile(file.key));
	}

	/** The file's path in the private root; a key that would leave it is refused. */
	private localPath(key: string): string {
		const root = inboxLocalRoot();
		const path = resolve(root, key);
		const inside = relative(root, path);
		if (!inside || inside.startsWith('..') || inside.includes(`..${sep}`) || resolve(path) === root) {
			throw new Error('The storage key leaves the Inbox storage directory.');
		}
		return path;
	}
}
