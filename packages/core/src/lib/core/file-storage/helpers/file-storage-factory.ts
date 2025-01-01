import * as multer from 'multer';
import * as path from 'path';
import { FileStorage } from '../file-storage';
import { DirectoryPathGenerator } from './directory-path-generator';
import { IDirectoryPathGenerator } from './directory-path-generator.interface';

// FileStorageFactory
export class FileStorageFactory {
	private static readonly pathGenerator: IDirectoryPathGenerator = new DirectoryPathGenerator();

	/**
	 * Creates a multer storage engine configured with a custom file storage system.
	 *
	 * This function generates the base directory and subdirectory paths based on
	 * the provided `baseDirname`, and returns a `multer.StorageEngine` instance
	 * that saves files to these paths.
	 *
	 * @param {string} baseDirname - The base directory name used to generate the file storage path.
	 * @returns {multer.StorageEngine} - A multer storage engine configured to store files.
	 */
	public static create(baseDirname: string): multer.StorageEngine {
		const baseDirectory = this.pathGenerator.getBaseDirectory(baseDirname);
		const subDirectory = this.pathGenerator.getSubDirectory();

		return new FileStorage().storage({
			dest: () => path.join(baseDirectory, subDirectory),
			prefix: baseDirname
		});
	}
}
