import multer from 'multer';
import * as path from 'path';
import { FileStorage } from '../file-storage';
import { DirectoryPathGenerator } from './directory-path-generator';
import { IDirectoryPathGenerator } from './directory-path-generator.interface';

// FileStorageFactory
export class FileStorageFactory {
	private static readonly pathGenerator: IDirectoryPathGenerator = new DirectoryPathGenerator();

	public static create(baseDirname: string): multer.StorageEngine {
		const baseDirectory = this.pathGenerator.getBaseDirectory(baseDirname);
		const subDirectory = this.pathGenerator.getSubDirectory();

		return new FileStorage().storage({
			dest: () => path.join(baseDirectory, subDirectory),
			prefix: baseDirname
		});
	}
}
