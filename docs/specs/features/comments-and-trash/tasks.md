# Task Breakdown: Comments and trash (platform part)

**Feature ID**: `comments-and-trash`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-11

---

## Platform (ever-gauzy, `feat/comments-reactions-trash`)

- [ ] **P1**. Contracts: `IReactionSummary`, `IReactionSummaryReactor`, `ICommentReactionsFindInput`; `ITaskTrashFindInput`
- [ ] **P2**. `GET /reaction/comments` (grouping helper + DTO), comments read through `CommentService.find`, reactions across reactors
- [ ] **P3**. `POST /reaction` on a comment reads the comment as the caller first
- [ ] **P4**. `CommentEvent('updated')` after a comment's reaction changes (create, toggle off, delete, withdraw, restore)
- [ ] **P5**. `editedAt` stamped by the server when the text changes; a body's value ignored
- [ ] **P6**. `GAUZY_TASK_TRASH_ENABLED` flag and guard; `.env.sample`; flags table
- [ ] **P7**. `GET /tasks/trash` with the permission/manager scope
- [ ] **P8**. `DELETE /tasks/:id/soft`, `PUT /tasks/:id/recover` (+ GraphQL twins) under the hard delete's grants; restore publishes `UPDATED`
- [ ] **P9**. `DELETE /tasks/:id` finds a trashed task, publishes `DELETED` only for a live one
- [ ] **P10**. Specs: summary grouping, readability, reaction events, `editedAt`, trash scope, soft/restore grants, flag
- [ ] **P11**. Bot threads answered; manual check on dev (react as two users, counts and names; edit marker; trash, restore, delete permanently)
- [ ] **P12**. `DELETE /tasks/:id/trashed`: Delete forever deletes only a
  task still in the trash, in one statement on both ORMs (a task restored
  meanwhile answers 404); the Angular trash page and Ever Teams use it

## Clients

- Ever Teams: `docs/specs/features/comments-and-trash/` in ever-teams (edit/delete/resolve, reactions, trash views).
- Angular: reactions in `ga-entity-comments` on the task page; task trash page. Shown only when the server answers
  `GET /reaction/comments` / `GET /tasks/trash`.
