import { DocumentThumbnailService } from './document-thumbnail.service';

export * from './thumbnail.constants';
export * from './document-thumbnail.service';

/** The thumbnail providers spread into the `DocsModule` providers array. */
export const ThumbnailProviders = [DocumentThumbnailService];
