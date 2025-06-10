import { FileStorageProviderEnum } from "@gauzy/contracts";
import { FileDTO } from "../dtos/file.dto";

export interface IPreparedFile {
	file: FileDTO;
	storageProvider: FileStorageProviderEnum;
}
