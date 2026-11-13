import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BaseEntityEnum, ID, IReactionSummary, ReactionEntityEnum } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { ICommentScope } from './comment.service';

/**
 * Client for the reactions on comments: the platform's summary of a record's comments (`GET /api/reaction/comments`:
 * everyone's reactions on the comments the caller can list, by comment and emoji) and its toggle (`POST /api/reaction`:
 * a second post of the same emoji takes the reaction back).
 */
@Injectable({
	providedIn: 'root'
})
export class CommentReactionService {
	private readonly API_URL = `${API_PREFIX}/reaction`;
	private readonly _http = inject(HttpClient);

	/** The reactions on the comments of one record, one entry per comment and emoji. */
	async getForRecord(entity: BaseEntityEnum, entityId: ID, scope: ICommentScope): Promise<IReactionSummary[]> {
		const answer = await firstValueFrom(
			this._http.get<IReactionSummary[]>(`${this.API_URL}/comments`, {
				params: toParams({ entity, entityId, ...scope })
			})
		);
		return Array.isArray(answer) ? answer : [];
	}

	/** Adds the caller's reaction to a comment, or takes it back when they already reacted with that emoji. */
	async toggle(commentId: ID, emoji: string, scope: ICommentScope): Promise<void> {
		await firstValueFrom(
			this._http.post(this.API_URL, { entity: ReactionEntityEnum.Comment, entityId: commentId, emoji, ...scope })
		);
	}
}
