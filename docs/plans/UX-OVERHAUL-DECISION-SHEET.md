# UX Overhaul Decision Sheet

> Purpose: lock product/contract decisions required to execute `docs/plans/UX-OVERHAUL-PLAN.md` without rework.
> Scope: only decisions needed for `UX-001` to `UX-044` plus cross-spec consistency.

---

## How to Use

- For each item, choose `Approve Recommended` or `Override`.
- If overridden, provide the selected option and any constraints.
- Once approved, these become the implementation defaults.

## Finalized Decisions (This Pass)

All decisions `D-01` through `D-16` are approved as recommended and are now implementation defaults for `UX-001` to `UX-044`.

---

## A) Capture Contract (`UX-001` to `UX-008`)

### D-01: Canonical capture endpoint

- **Decision:** Should `POST /api/capture` be the only public capture endpoint?
- **Recommended:** **Yes**. Keep `POST /api/notes/route` compatibility-only (internal), then remove after migration (`UX-003`).
- **Why:** One contract for classify + execute + normalized UI outcome.

### D-02: Outcome payload shape

- **Decision:** Approve normalized `RouteExecutionOutcome` schema?
- **Recommended:** **Yes**, with this shape:

```ts
type RouteExecutionOutcome = {
	kind:
		| "new_note"
		| "update_existing"
		| "correction"
		| "split"
		| "fan_out"
		| "workspace_action"
		| "ephemeral_answer"
		| "store_preference"
		| "duplicate";
	uiAction: "open_note" | "stay_blank" | "show_ephemeral" | "show_toast";
	noteId?: string;
	noteIds?: string[];
	toast?: { message: string; tone?: "info" | "success" | "warning" | "error" };
	ephemeral?: { content: string; dismiss: "on_input" | "timeout"; timeoutMs?: number };
	secondaryEffects?: Array<{
		type:
			| "updated_note"
			| "created_note"
			| "queued_fanout"
			| "action_executed"
			| "preference_saved";
		id?: string;
		label?: string;
	}>;
};
```

### D-03: Long-running route behavior (`fan_out`)

- **Decision:** Sync completion vs accepted-then-background?
- **Recommended:** **Accepted-then-background**. Return immediate outcome with `secondaryEffects: [{ type: "queued_fanout" }]`.
- **Why:** Keeps capture loop fast and predictable.

### D-04: Error envelope standard

- **Decision:** Approve single error contract?
- **Recommended:** **Yes**:

```ts
type CaptureError = {
	error: {
		code:
			| "INVALID_INPUT"
			| "UNAUTHORIZED"
			| "RATE_LIMITED"
			| "ROUTE_EXECUTION_FAILED"
			| "DEPENDENCY_UNAVAILABLE"
			| "INTERNAL";
		message: string;
		recoverable: boolean;
	};
};
```

### D-05: Audit/telemetry minimum event fields

- **Decision:** Approve minimum required fields for every capture decision/outcome?
- **Recommended:** **Yes**. Require: `eventId`, `userId`, `routeKind`, `uiAction`, `noteId?`, `secondaryEffects[]`, `success`, `errorCode?`, `timestamp`.

---

## B) Route Execution Matrix (`UX-033` to `UX-044`)

### D-06: Route -> UI behavior table

- **Decision:** Approve this canonical mapping?
- **Recommended:** **Yes**.

| Route kind         | Server effect                                  | UI action                           |
| ------------------ | ---------------------------------------------- | ----------------------------------- |
| `new_note`         | Create + rewrite                               | Open created note                   |
| `update_existing`  | Rewrite target note                            | Open updated note                   |
| `correction`       | Apply correction to target                     | Open corrected note + toast         |
| `split`            | Create N notes                                 | Open primary + toast listing others |
| `fan_out`          | Create/open primary + queue background updates | Open primary + toast                |
| `workspace_action` | Execute action only                            | Stay blank + toast                  |
| `ephemeral_answer` | No note write                                  | Show ephemeral content, then blank  |
| `store_preference` | Persist preference                             | Stay blank + toast                  |
| `duplicate`        | No note write                                  | Stay blank + toast with link        |

### D-07: Primary note selection for `split`/`fan_out`

- **Decision:** How do we choose the note shown in canvas?
- **Recommended:** **Deterministic primary** = highest relevance score from router. Tie-break by most recent touched note, else first created.

### D-08: Blank reset policy for non-note outcomes

- **Decision:** Should non-note routes always return to blank-ready state?
- **Recommended:** **Yes** (`workspace_action`, `store_preference`, `duplicate`, post-ephemeral).

### D-09: Ephemeral answer lifecycle

- **Decision:** Timeout and dismissal behavior?
- **Recommended:** **Dismiss on next user input** and auto-timeout at `8000ms` if idle.

### D-10: Workspace action allowlist (v1)

- **Decision:** Which actions are executable in v1?
- **Recommended:** **Allowlist only**: `archive_note(s)`, `mark_collection_resolved`, `rename_collection`, `link_notes`, `unlink_notes`.
- **Not in v1 allowlist:** destructive bulk deletes.

### D-11: Duplicate/correction confidence gating

- **Decision:** What happens when confidence is low?
- **Recommended:**
  - High confidence: execute route directly.
  - Medium confidence: execute but include explicit toast context/link.
  - Low confidence: fall back to `new_note` (never silently mutate wrong note).

---

## C) Cross-Spec Alignment (avoid implementation churn)

### D-12: Primary action label (`Save` vs `Go`)

- **Decision:** Which label is canonical for launch?
- **Recommended:** **Save** in product UI, keep internal pipeline language as "capture".
- **Why:** Matches current overhaul plan language and keyboard hint expectations.

### D-13: Primary navigation model for active note

- **Decision:** Workspace query param or dedicated note route?
- **Recommended:** **Workspace + `?noteId=`** as primary during overhaul; optional dedicated route later.
- **Why:** Keeps sidebar/canvas mental model intact and minimizes route churn.

### D-14: History scope at UX launch

- **Decision:** Inspect-only vs inspect + revert?
- **Recommended:** **Inspect + lightweight revert** (safe confirmation + audit event) to satisfy trust model.

### D-15: Slash command namespace

- **Decision:** How to avoid conflict between editor slash commands and agent commands?
- **Recommended:**
  - Editor formatting commands keep `/heading`, `/code`, etc.
  - Agent commands are explicit `/ask`, `/research`, `/link`, `/summarize`, plus freeform only when command is unknown to editor.

### D-16: Vector requirement for launch

- **Decision:** Required at launch or fallback-first?
- **Recommended:** **Fallback-first**. Ship reliable keyword/structured retrieval first; vectors enhance when enabled.

---

## Decision Log (fill as approved)

| ID   | Status   | Final choice                                               | Notes                                                                                                                                    |
| ---- | -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Approved | `POST /api/capture` only public capture endpoint           | Keep `POST /api/notes/route` internal compatibility-only; remove after migration (`UX-003`)                                              |
| D-02 | Approved | Canonical `RouteExecutionOutcome` schema                   | Use exact type defined in this sheet as cross-web/server contract                                                                        |
| D-03 | Approved | `fan_out` is accepted-then-background                      | Return immediate outcome with `secondaryEffects: [{ type: "queued_fanout" }]`                                                            |
| D-04 | Approved | Standard `CaptureError` envelope                           | Use canonical `error.code`, `error.message`, `recoverable` shape                                                                         |
| D-05 | Approved | Required audit/telemetry event fields                      | Require: `eventId`, `userId`, `routeKind`, `uiAction`, `noteId?`, `secondaryEffects[]`, `success`, `errorCode?`, `timestamp`             |
| D-06 | Approved | Route->server effect->UI mapping table is canonical        | Implement exactly as listed in this sheet                                                                                                |
| D-07 | Approved | Deterministic primary note selection                       | Highest router relevance score; tie-break by most recent touched; else first created                                                     |
| D-08 | Approved | Non-note routes reset canvas to blank-ready state          | Applies to `workspace_action`, `store_preference`, `duplicate`, and post-ephemeral                                                       |
| D-09 | Approved | Ephemeral answer dismissal lifecycle                       | Dismiss on next user input; auto-timeout at `8000ms` idle                                                                                |
| D-10 | Approved | v1 workspace action allowlist only                         | Allow: `archive_note(s)`, `mark_collection_resolved`, `rename_collection`, `link_notes`, `unlink_notes`; exclude destructive bulk delete |
| D-11 | Approved | Confidence gating for duplicate/correction routes          | High: execute; Medium: execute + explicit toast/link; Low: fallback to `new_note`                                                        |
| D-12 | Approved | Canonical primary action label is `Save`                   | Keep internal term `capture` for pipeline language                                                                                       |
| D-13 | Approved | Workspace route with `?noteId=` is primary model           | Dedicated note route remains optional follow-up                                                                                          |
| D-14 | Approved | History launch scope includes inspect + lightweight revert | Revert requires safe confirmation and audit event                                                                                        |
| D-15 | Approved | Slash namespace split: editor vs agent commands            | Editor keeps formatting slash commands; agent commands are `/ask`, `/research`, `/link`, `/summarize`, then unknown-command freeform     |
| D-16 | Approved | Retrieval strategy is fallback-first                       | Launch reliable keyword/structured retrieval first; vectors are enhancement, not blocker                                                 |
