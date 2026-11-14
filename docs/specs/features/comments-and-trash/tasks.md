# Task Breakdown: Comments and trash (platform part)

**Feature ID**: `comments-and-trash`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-13

---

## Platform (ever-gauzy, `feat/comments-reactions-trash`)

- [x] **P1**. Contracts: `IReactionSummary`, `IReactionSummaryReactor`, `ICommentReactionsFindInput`; `ITaskTrashFindInput` ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P2**. `GET /reaction/comments` (grouping helper + DTO), comments read through `CommentService.find`, reactions across reactors ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P3**. `POST /reaction` on a comment reads the comment as the caller first ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P4**. `CommentEvent('updated')` after a comment's reaction changes (create, toggle off, delete, withdraw, restore) ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P5**. `editedAt` stamped by the server when the text changes; a body's value ignored ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P6**. `GAUZY_TASK_TRASH_ENABLED` flag and guard; `.env.sample`; flags table ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P7**. `GET /tasks/trash` with the permission/manager scope ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802))
- [x] **P8**. `DELETE /tasks/:id/soft`, `PUT /tasks/:id/recover` (+ GraphQL twins) under the hard delete's grants; restore publishes `UPDATED` ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802), [#11832](https://github.com/ever-co/ever-gauzy/pull/11832))
- [x] **P9**. `DELETE /tasks/:id` finds a trashed task, publishes `DELETED` only for a live one ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802), [#11894](https://github.com/ever-co/ever-gauzy/pull/11894))
- [x] **P10**. Specs: summary grouping, readability, reaction events, `editedAt`, trash scope, soft/restore grants, flag ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802), [#11894](https://github.com/ever-co/ever-gauzy/pull/11894))
- [ ] **P11**. Bot threads answered; manual check on dev (react as two users, counts and names; edit marker; trash, restore, delete permanently)
- [x] **P12**. `DELETE /tasks/:id/trashed`: Delete forever deletes only a
  task still in the trash, in one statement on both ORMs (a task restored
  meanwhile answers 404); the Angular trash page and Ever Teams use it ([#11851](https://github.com/ever-co/ever-gauzy/pull/11851), [#11894](https://github.com/ever-co/ever-gauzy/pull/11894), [#11815](https://github.com/ever-co/ever-gauzy/pull/11815), [ever-teams#5153](https://github.com/ever-co/ever-teams/pull/5153))

## Clients

- Ever Teams: `docs/specs/features/comments-and-trash/` in ever-teams (edit/delete/resolve, reactions, trash views).
- Angular: reactions in `ga-entity-comments` on the task page; task trash page. Shown only when the server answers
  `GET /reaction/comments` / `GET /tasks/trash`.
