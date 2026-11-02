import { SetMetadata } from '@nestjs/common';

/** The metadata key that marks a provider as an {@link ICommentParentAccessPolicy}. */
export const COMMENT_PARENT_ACCESS_POLICY = 'COMMENT_PARENT_ACCESS_POLICY';

/**
 * Marks an injectable as the comment-access policy of the record type it names, so that the comment service
 * applies it to every read and write of that type's comments. The class implements
 * {@link ICommentParentAccessPolicy} and is listed in its own module's providers; nothing else needs wiring.
 */
export const CommentParentAccessPolicy = (): ClassDecorator => SetMetadata(COMMENT_PARENT_ACCESS_POLICY, true);
