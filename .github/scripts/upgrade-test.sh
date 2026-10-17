#!/usr/bin/env bash
# Upgrade test: develop's API image seeds a FRESH database, then this branch's API image boots on that SAME
# database — every pending migration has to apply on top of develop's schema and data, and the app has to serve.
# Run by .github/workflows/upgrade-test.yml, one call per database.
#
#   upgrade-test.sh <sqlite|postgres> [upgrade|fresh]
#     upgrade (default)  before image + demo seed -> stop -> after image on the same database
#     fresh              control: the after image alone on a fresh database (attributes a failure to the
#                        upgrade or to the branch itself)
#
# Environment:
#   BEFORE_IMAGE     develop's API image (upgrade mode)
#   AFTER_IMAGE      this branch's API image
#   NEW_MIGRATIONS   file, one "name<TAB>path" per migration file this branch adds over the before image's commit
#   RESULTS_DIR      where checks.tsv, the migration lists and the (scrubbed) logs go
#   POSTGRES_IMAGE   default postgres:16
#   BOOT_TIMEOUT_MIN default 60 — one boot, demo seed included
#   GATED_PLUGIN_FLAGS  optional, upgrade mode: space-separated KEY=true switches of the plugins that load only when
#                    switched on (the Ever Works integration, the Inbox, Inbox email, the email providers). Set, this
#                    branch's image boots once more on the same database with them on, and its checks go to
#                    "$RESULTS_DIR/<db>-gated/" (see "gated plugins" below). Unset, nothing of it runs.
#   GATED_SMOKE_PATHS   optional: comma-separated GET routes of those plugins that must answer 200 then
#
# Every check is written to "$RESULTS_DIR/<label>/checks.tsv" as "check<TAB>pass|fail|info<TAB>detail" for the
# job summary. The script exits 1 when any check failed. Nothing is pushed or published: the images stay on the
# runner, the database lives in a throwaway volume or container, and the secrets are random per run.
# cspell:words dind
set -euo pipefail
export LC_ALL=C # comm and sort must agree on one collation
exec 3>&1       # the job log, for ::add-mask:: from inside command substitutions

DB="${1:?usage: upgrade-test.sh <sqlite|postgres> [upgrade|fresh]}"
MODE="${2:-upgrade}"
case "$DB" in sqlite | postgres) ;; *) echo "unknown database: $DB" >&2; exit 2 ;; esac
case "$MODE" in upgrade | fresh) ;; *) echo "unknown mode: $MODE" >&2; exit 2 ;; esac

: "${AFTER_IMAGE:?}" "${NEW_MIGRATIONS:?}" "${RESULTS_DIR:?}"
[ "$MODE" = fresh ] || : "${BEFORE_IMAGE:?}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16}"
BOOT_TIMEOUT_MIN="${BOOT_TIMEOUT_MIN:-60}"

LABEL="$DB"
[ "$MODE" = fresh ] && LABEL="$DB-fresh"
NET="gauzy-upgrade"
API="gauzy-upgrade-api"
PG="gauzy-upgrade-pg"
VOL="gauzy-upgrade-$LABEL"
OUT="$RESULTS_DIR/$LABEL"
mkdir -p "$OUT"
: >"$OUT/checks.tsv"
FAILED=0

# ---------------------------------------------------------------------------------------------- helpers

# check <name> <pass|fail|info> <detail>
check() {
	printf '%s\t%s\t%s\n' "$1" "$2" "${3//$'\n'/ }" >>"$OUT/checks.tsv"
	case "$2" in
	pass) echo "PASS  $1 — $3" ;;
	info) echo "INFO  $1 — $3" ;;
	*)
		echo "::error title=upgrade test ($LABEL)::$1 — $3"
		FAILED=1
		;;
	esac
}

# A throwaway secret. Masked, so a value that does reach a log line prints as ***.
secret() {
	local value
	value="$(openssl rand -hex 32)"
	echo "::add-mask::$value" >&3
	printf '%s' "$value"
}

SUPER_ADMIN_EMAIL="upgrade-admin@example.com"
SUPER_ADMIN_PASSWORD="$(secret)"
PG_PASSWORD="$(secret)"
SECRETS=("$SUPER_ADMIN_PASSWORD" "$PG_PASSWORD")

# One env file for every boot of this database: the before and after images share the secrets, exactly as an
# environment keeps its configuration across a deploy. Outside the workspace, so no artifact can pick it up.
ENV_FILE="$(mktemp "${RUNNER_TEMP:-/tmp}/upgrade-test-env.XXXXXX")"
chmod 600 "$ENV_FILE"
{
	echo "API_HOST=0.0.0.0"
	echo "API_PORT=3000"
	echo "PORT=3000"
	echo "REDIS_ENABLED=false"
	# commerce-e2e reads the composed schema (__schema); the image runs NODE_ENV=production, where introspection is off
	# by default (graphql-policy.ts). Turned on for the test only — it changes what the API answers, not the database.
	echo "GRAPHQL_INTROSPECTION=true"
	echo "DEMO_SUPER_ADMIN_EMAIL=$SUPER_ADMIN_EMAIL"
	echo "DEMO_SUPER_ADMIN_PASSWORD=$SUPER_ADMIN_PASSWORD"
	for key in DEMO_ADMIN_PASSWORD DEMO_EMPLOYEE_PASSWORD JWT_SECRET JWT_REFRESH_TOKEN_SECRET \
		JWT_VERIFICATION_TOKEN_SECRET EXPRESS_SESSION_SECRET; do
		value="$(secret)"
		SECRETS+=("$value")
		echo "$key=$value"
	done
	if [ "$DB" = sqlite ]; then
		echo "DB_TYPE=better-sqlite3"
		echo "DB_PATH=/data/gauzy.sqlite3"
	else
		echo "DB_TYPE=postgres"
		echo "DB_HOST=$PG"
		echo "DB_PORT=5432"
		echo "DB_NAME=gauzy"
		echo "DB_USER=postgres"
		echo "DB_PASS=$PG_PASSWORD"
		echo "DB_SSL_MODE=false"
	fi
} >"$ENV_FILE"

DB_ARGS=()
[ "$DB" = sqlite ] && DB_ARGS=(-v "$VOL:/data")

cleanup() {
	docker rm -f "$API" >/dev/null 2>&1 || true
	[ "$DB" = postgres ] && docker rm -f "$PG" >/dev/null 2>&1 || true
	docker volume rm "$VOL" >/dev/null 2>&1 || true
	rm -f "$ENV_FILE" "${GATED_ENV_FILE:-}"
}
trap cleanup EXIT

# Saves the API container's whole log with every secret of this run replaced.
save_logs() {
	local file="$OUT/$1.log" value
	docker logs "$API" >"$file" 2>&1 || true
	for value in "${SECRETS[@]}"; do sed -i "s/$value/***/g" "$file"; done
}

# boot <image> <demo:true|false> [env file, default $ENV_FILE]
boot() {
	docker rm -f "$API" >/dev/null 2>&1 || true
	docker run -d --name "$API" --network "$NET" --env-file "${3:-$ENV_FILE}" -e DEMO="$2" "${DB_ARGS[@]}" "$1" >/dev/null
}

# wait_ready <phase> <demo:true|false>: until /api/health answers 200 and, in demo mode, the demo seed finished.
# Sets READY_DETAIL. Returns 1 when the container exits, the demo seed reports an error, or the time runs out.
wait_ready() {
	local phase="$1" demo="$2" start now healthy="" logs
	start=$(date +%s)
	while :; do
		now=$(date +%s)
		if [ "$(docker inspect -f '{{.State.Running}}' "$API" 2>/dev/null)" != "true" ]; then
			READY_DETAIL="the container exited after $((now - start)) s (exit code $(docker inspect -f '{{.State.ExitCode}}' "$API" 2>/dev/null))"
			return 1
		fi
		# Probed from inside the container (busybox wget), so no port is published on the runner.
		if [ -z "$healthy" ] && docker exec "$API" wget -q -T 5 -O /dev/null http://127.0.0.1:3000/api/health 2>/dev/null; then
			healthy=$((now - start))
			echo "$phase: /api/health 200 after $healthy s"
		fi
		if [ -n "$healthy" ]; then
			[ "$demo" = "true" ] || { READY_DETAIL="/api/health 200 after $healthy s"; return 0; }
			logs="$(docker logs "$API" 2>&1 || true)"
			if grep -q 'Error seeding demo environment' <<<"$logs"; then
				READY_DETAIL="the demo seed reported an error after $((now - start)) s"
				return 1
			fi
			if grep -q 'Demo environment seeded successfully' <<<"$logs"; then
				READY_DETAIL="/api/health 200 after $healthy s, demo seed done after $((now - start)) s"
				return 0
			fi
		fi
		if [ $((now - start)) -ge $((BOOT_TIMEOUT_MIN * 60)) ]; then
			READY_DETAIL="not ready within $BOOT_TIMEOUT_MIN min (health: ${healthy:-never 200})"
			return 1
		fi
		sleep 10
	done
}

stop_api() {
	docker stop -t 120 "$API" >/dev/null 2>&1 || true
}

# The first lines that look like an error, for a check's detail.
error_lines() {
	grep -E 'QueryFailedError|MigrationError|Error during migration|Unable to connect to the database|migration.*(failed|error)|Nest can.t|Error: |ERROR \[' "$1" |
		grep -v 'INSECURE' | head -5 | cut -c1-300 || true
}

# dump_migrations <file>: the executed-migration rows ("timestamp<TAB>name"), as TypeORM recorded them.
dump_migrations() {
	if [ "$DB" = sqlite ]; then
		# better-sqlite3 from the after image; the database file is closed (the API container is stopped).
		docker run --rm --network none -v "$VOL:/data" -w /srv/gauzy --entrypoint node "$AFTER_IMAGE" -e '
			const Database = require("better-sqlite3");
			const db = new Database("/data/gauzy.sqlite3", { fileMustExist: true });
			const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = ? AND name = ?").get("table", "migrations");
			if (exists) for (const row of db.prepare("SELECT timestamp, name FROM migrations ORDER BY timestamp, name").all()) console.log(row.timestamp + "\t" + row.name);
			db.close();' >"$1"
	else
		docker exec "$PG" psql -U postgres -d gauzy -v ON_ERROR_STOP=1 -AtF $'\t' -c \
			"SELECT \"timestamp\", \"name\" FROM \"migrations\" ORDER BY \"timestamp\", \"name\"" >"$1" 2>/dev/null || : >"$1"
	fi
}

# run_node <name> <script> [env...]: a Node script from this checkout, run with the after image's Node on the
# test network (stdin, so no bind mount — works the same on a hosted runner and on an ARC dind runner).
run_node() {
	local name="$1" script="$2"
	shift 2
	local args=(--rm -i --network "$NET" -e "BASE_URL=http://$API:3000" -e "E2E_EMAIL=$SUPER_ADMIN_EMAIL"
		-e "E2E_PASSWORD=$SUPER_ADMIN_PASSWORD" -e "E2E_TIMEOUT_MS=60000")
	local env
	for env in "$@"; do args+=(-e "$env"); done
	docker run "${args[@]}" --entrypoint node "$AFTER_IMAGE" --input-type=module - <"$script" >"$OUT/$name.out" 2>&1
}

# ---------------------------------------------------------------------------------------------- database

docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null

if [ "$DB" = sqlite ]; then
	docker volume rm "$VOL" >/dev/null 2>&1 || true
	docker volume create "$VOL" >/dev/null
	# A fresh named volume is root-owned; the images run as `node`.
	docker run --rm --user root --entrypoint sh -v "$VOL:/data" "$AFTER_IMAGE" -c 'chown node:node /data'
	check "database" info "SQLite (better-sqlite3), file on a volume shared by both boots"
else
	docker rm -f "$PG" >/dev/null 2>&1 || true
	docker run -d --name "$PG" --network "$NET" -e POSTGRES_PASSWORD="$PG_PASSWORD" -e POSTGRES_DB=gauzy "$POSTGRES_IMAGE" >/dev/null
	# Over TCP: the official image first runs its init scripts on a socket-only server, then restarts.
	for i in $(seq 1 60); do
		docker exec "$PG" pg_isready -h 127.0.0.1 -U postgres -d gauzy >/dev/null 2>&1 && break
		[ "$i" = 60 ] && { check "database" fail "$POSTGRES_IMAGE not ready within 2 min"; exit 1; }
		sleep 2
	done
	check "database" info "$(docker exec "$PG" psql -U postgres -d gauzy -Atc 'SHOW server_version') ($POSTGRES_IMAGE), one container shared by both boots"
fi

# ---------------------------------------------------------------------------------------------- before

: >"$OUT/before-migrations.tsv"
if [ "$MODE" = upgrade ]; then
	boot "$BEFORE_IMAGE" true
	if wait_ready before true; then
		check "before: boot + demo seed (fresh database)" pass "$READY_DETAIL"
	else
		save_logs before
		check "before: boot + demo seed (fresh database)" fail "$READY_DETAIL: $(error_lines "$OUT/before.log")"
		docker logs --tail 150 "$API" 2>&1 | sed 's/^/    /'
		exit 1
	fi
	if run_node before-smoke .github/scripts/upgrade-test-smoke.mjs SMOKE_COMMERCE=false; then
		check "before: super admin login" pass "login + GET /api/user/me"
	else
		check "before: super admin login" fail "$(grep FAIL "$OUT/before-smoke.out" | head -3)"
	fi
	stop_api
	save_logs before
	dump_migrations "$OUT/before-migrations.tsv"
	if [ -s "$OUT/before-migrations.tsv" ]; then
		check "before: migrations recorded" pass "$(wc -l <"$OUT/before-migrations.tsv") rows, last $(tail -1 "$OUT/before-migrations.tsv" | cut -f2)"
	else
		check "before: migrations recorded" fail "no rows in the migrations table after develop's boot"
		exit 1
	fi
fi

# ---------------------------------------------------------------------------------------------- after

# The demo runs DEMO=true; stage and prod (PostgreSQL) run without it, so the PostgreSQL upgrade boots that way.
AFTER_DEMO=true
[ "$DB" = postgres ] && [ "$MODE" = upgrade ] && AFTER_DEMO=false
AFTER_TITLE="after: boot on the same database (DEMO=$AFTER_DEMO)"
[ "$MODE" = fresh ] && AFTER_TITLE="after: boot + demo seed on a fresh database"

boot "$AFTER_IMAGE" "$AFTER_DEMO"
if wait_ready after "$AFTER_DEMO"; then
	check "$AFTER_TITLE" pass "$READY_DETAIL"
	AFTER_UP=1
else
	save_logs after
	check "$AFTER_TITLE" fail "$READY_DETAIL: $(error_lines "$OUT/after.log")"
	docker logs --tail 200 "$API" 2>&1 | sed 's/^/    /'
	AFTER_UP=0
fi

if [ "$AFTER_UP" = 1 ]; then
	if run_node after-smoke .github/scripts/upgrade-test-smoke.mjs SMOKE_COMMERCE=true; then
		check "after: login, /api/user/me, GraphQL, commerce query" pass "$(grep -c '^PASS' "$OUT/after-smoke.out") checks"
	else
		check "after: login, /api/user/me, GraphQL, commerce query" fail "$(grep '^FAIL' "$OUT/after-smoke.out" | head -3)"
	fi
	sed 's/^/    /' "$OUT/after-smoke.out"

	for suite in commerce-e2e commerce-flow-e2e return-receipt-e2e; do
		if run_node "$suite" "tools/scripts/$suite.mjs"; then status=pass; else status=fail; fi
		# `|| true`: an assignment takes its substitution's status, and a suite that died before its tally must
		# still be recorded (and the rest of the run still happen) rather than stop the script under `set -e`.
		tally="$(grep -oE '[0-9]+ of [0-9]+ checks passed' "$OUT/$suite.out" | tail -1 || true)"
		detail="${tally:-could not run}"
		# Failure lines: "  FAILED  name" (commerce-e2e, commerce-flow-e2e), "  FAILED: name" (return-receipt-e2e).
		[ "$status" = fail ] && detail="$detail; $(grep -E '^\s+FAILED[: ]' "$OUT/$suite.out" | head -3 | sed 's/^ *//' | tr '\n' ';' || true)"
		check "after: $suite" "$status" "$detail"
		echo "    $suite: ${tally:-no tally}"
	done

	stop_api
	save_logs after
fi

dump_migrations "$OUT/after-migrations.tsv"

# ---------------------------------------------------------------------------------------------- migrations

# Only the boot — up to the "Listening at" line — is the migration run: the e2e suites afterwards provoke query
# errors on purpose (a create without its required field must answer 400), and those are not migration errors.
LOG="$OUT/after-boot.log"
awk '{ print } /Listening at http/ { exit }' "$OUT/after.log" >"$LOG"
# One tolerated line: develop's AddDocumentChunkVector1790000002000 tries `CREATE EXTENSION vector` and, where the
# server has no pgvector (the stock postgres image), logs "pgvector extension unavailable … QueryFailedError" and
# degrades retrieval to lexical — a documented outcome, not a failed migration.
errors="$(grep -E 'QueryFailedError|Error during migration|MigrationError|Unable to connect to the database' "$LOG" |
	grep -vc 'pgvector extension unavailable' || true)"
if [ "${errors:-0}" = 0 ]; then
	check "after: migration errors in the API log" pass "none"
else
	check "after: migration errors in the API log" fail "$errors line(s): $(error_lines "$LOG")"
fi

cut -f2 "$OUT/before-migrations.tsv" | sort -u >"$OUT/before.names"
cut -f2 "$OUT/after-migrations.tsv" | sort -u >"$OUT/after.names"
comm -13 "$OUT/before.names" "$OUT/after.names" >"$OUT/applied.names"
comm -23 "$OUT/before.names" "$OUT/after.names" >"$OUT/lost.names"
cut -f1 "$NEW_MIGRATIONS" | sort -u >"$OUT/new.names"
# A file this branch adds whose migration develop had already run (moved, or develop got it too) is not pending.
comm -23 "$OUT/new.names" "$OUT/before.names" >"$OUT/expected.names"
comm -23 "$OUT/expected.names" "$OUT/after.names" >"$OUT/missing.names"
comm -13 "$OUT/expected.names" "$OUT/applied.names" >"$OUT/unexpected.names"

applied=$(wc -l <"$OUT/applied.names")
expected=$(wc -l <"$OUT/expected.names")
missing=$(wc -l <"$OUT/missing.names")

if [ "$MODE" = upgrade ]; then
	check "after: migrations applied by the upgrade" "$([ "$applied" -gt 0 ] || [ "$expected" = 0 ] && echo pass || echo fail)" \
		"$applied (rows $(wc -l <"$OUT/before-migrations.tsv") -> $(wc -l <"$OUT/after-migrations.tsv"))"
else
	check "after: migrations recorded" "$([ -s "$OUT/after.names" ] && echo pass || echo fail)" "$(wc -l <"$OUT/after.names")"
fi

if [ "$missing" = 0 ]; then
	check "after: every migration this branch adds is recorded" pass "$expected of $expected"
else
	check "after: every migration this branch adds is recorded" fail \
		"$((expected - missing)) of $expected; missing: $(head -5 "$OUT/missing.names" | tr '\n' ' ')$([ "$missing" -gt 5 ] && echo "… (+$((missing - 5)))")"
fi

if [ -s "$OUT/lost.names" ]; then
	check "after: develop's migration rows kept" fail "$(wc -l <"$OUT/lost.names") gone: $(head -5 "$OUT/lost.names" | tr '\n' ' ')"
elif [ "$MODE" = upgrade ]; then
	check "after: develop's migration rows kept" pass "all $(wc -l <"$OUT/before.names")"
fi

if [ -s "$OUT/unexpected.names" ]; then
	# Not a failure: a before image a little behind develop's tip leaves develop's newest migrations pending too.
	check "after: applied but not added by this branch" info "$(wc -l <"$OUT/unexpected.names"): $(head -5 "$OUT/unexpected.names" | tr '\n' ' ')"
fi

duplicates=$(cut -f2 "$OUT/after-migrations.tsv" | sort | uniq -d | wc -l)
if [ "$duplicates" = 0 ]; then
	check "after: no migration recorded twice" pass "0"
else
	check "after: no migration recorded twice" fail "$duplicates: $(cut -f2 "$OUT/after-migrations.tsv" | sort | uniq -d | head -5 | tr '\n' ' ')"
fi

echo
echo "Migrations applied by the after image ($applied):"
sed 's/^/    /' "$OUT/applied.names"

# ---------------------------------------------------------------------------------------------- gated plugins

# The plugins behind a switch (the Ever Works integration, the Inbox, Inbox email, the email providers) load, and
# register their migrations, only when their switch is exactly `true`; the boots above run with every switch off, so
# they never run those migrations (a new one of theirs reads as missing above until develop's image has it). Here
# this branch's image boots once more on the SAME database with the switches on: their migrations have to apply on
# top of everything above, and the API has to serve, the switched-on plugins' routes included. Additive: every
# check above is unchanged; these go to their own column of the summary ("<db>-gated").
if [ "$MODE" = upgrade ] && [ -n "${GATED_PLUGIN_FLAGS:-}" ]; then
	MAIN_OUT="$OUT"
	OUT="$RESULTS_DIR/$LABEL-gated"
	mkdir -p "$OUT"
	: >"$OUT/checks.tsv"
	GATED_ENV_FILE="$(mktemp "${RUNNER_TEMP:-/tmp}/upgrade-test-env-gated.XXXXXX")"
	chmod 600 "$GATED_ENV_FILE"
	cp "$ENV_FILE" "$GATED_ENV_FILE"
	# The integration and the provider accounts store their secrets sealed with ENCRYPTION_KEY (a base64 32-byte key).
	ENCRYPTION_KEY_VALUE="$(openssl rand -base64 32)"
	echo "::add-mask::$ENCRYPTION_KEY_VALUE" >&3
	SECRETS+=("$ENCRYPTION_KEY_VALUE")
	{
		for flag in $GATED_PLUGIN_FLAGS; do echo "$flag"; done
		echo "ENCRYPTION_KEY=$ENCRYPTION_KEY_VALUE"
	} >>"$GATED_ENV_FILE"
	check "gated plugins: switches" info "$GATED_PLUGIN_FLAGS"

	if [ "$AFTER_UP" != 1 ]; then
		check "gated plugins: boot on the same database (DEMO=$AFTER_DEMO)" fail "not run: this branch's image did not come up with the switches off"
	else
		cp "$MAIN_OUT/after-migrations.tsv" "$OUT/before-migrations.tsv"
		boot "$AFTER_IMAGE" "$AFTER_DEMO" "$GATED_ENV_FILE"
		if wait_ready gated "$AFTER_DEMO"; then
			check "gated plugins: boot on the same database (DEMO=$AFTER_DEMO)" pass "$READY_DETAIL"
			if run_node gated-smoke .github/scripts/upgrade-test-smoke.mjs SMOKE_COMMERCE=true "SMOKE_GET_PATHS=${GATED_SMOKE_PATHS:-}"; then
				check "gated plugins: login, GraphQL, the plugins' routes" pass "$(grep -c '^PASS' "$OUT/gated-smoke.out") checks"
			else
				check "gated plugins: login, GraphQL, the plugins' routes" fail "$(grep '^FAIL' "$OUT/gated-smoke.out" | head -3)"
			fi
			sed 's/^/    /' "$OUT/gated-smoke.out"
			stop_api
			save_logs gated
		else
			save_logs gated
			check "gated plugins: boot on the same database (DEMO=$AFTER_DEMO)" fail "$READY_DETAIL: $(error_lines "$OUT/gated.log")"
			docker logs --tail 200 "$API" 2>&1 | sed 's/^/    /'
			stop_api
		fi
		dump_migrations "$OUT/after-migrations.tsv"

		awk '{ print } /Listening at http/ { exit }' "$OUT/gated.log" >"$OUT/gated-boot.log"
		errors="$(grep -E 'QueryFailedError|Error during migration|MigrationError|Unable to connect to the database' "$OUT/gated-boot.log" |
			grep -vc 'pgvector extension unavailable' || true)"
		if [ "${errors:-0}" = 0 ]; then
			check "gated plugins: migration errors in the API log" pass "none"
		else
			check "gated plugins: migration errors in the API log" fail "$errors line(s): $(error_lines "$OUT/gated-boot.log")"
		fi

		cut -f2 "$OUT/before-migrations.tsv" | sort -u >"$OUT/before.names"
		cut -f2 "$OUT/after-migrations.tsv" | sort -u >"$OUT/after.names"
		comm -13 "$OUT/before.names" "$OUT/after.names" >"$OUT/applied.names"
		comm -23 "$OUT/before.names" "$OUT/after.names" >"$OUT/lost.names"
		comm -23 "$MAIN_OUT/expected.names" "$OUT/after.names" >"$OUT/missing.names"
		gated_expected=$(wc -l <"$MAIN_OUT/expected.names")
		gated_missing=$(wc -l <"$OUT/missing.names")

		check "gated plugins: migrations applied by the switched-on boot" info \
			"$(wc -l <"$OUT/applied.names") (rows $(wc -l <"$OUT/before-migrations.tsv") -> $(wc -l <"$OUT/after-migrations.tsv"))"
		if [ "$gated_missing" = 0 ]; then
			check "gated plugins: every migration this branch adds is recorded" pass "$gated_expected of $gated_expected"
		else
			check "gated plugins: every migration this branch adds is recorded" fail \
				"$((gated_expected - gated_missing)) of $gated_expected; missing: $(head -5 "$OUT/missing.names" | tr '\n' ' ')$([ "$gated_missing" -gt 5 ] && echo "… (+$((gated_missing - 5)))")"
		fi
		if [ -s "$OUT/lost.names" ]; then
			check "gated plugins: earlier migration rows kept" fail "$(wc -l <"$OUT/lost.names") gone: $(head -5 "$OUT/lost.names" | tr '\n' ' ')"
		else
			check "gated plugins: earlier migration rows kept" pass "all $(wc -l <"$OUT/before.names")"
		fi
		gated_duplicates=$(cut -f2 "$OUT/after-migrations.tsv" | sort | uniq -d | wc -l)
		if [ "$gated_duplicates" = 0 ]; then
			check "gated plugins: no migration recorded twice" pass "0"
		else
			check "gated plugins: no migration recorded twice" fail "$gated_duplicates: $(cut -f2 "$OUT/after-migrations.tsv" | sort | uniq -d | head -5 | tr '\n' ' ')"
		fi

		echo
		echo "Migrations applied by the switched-on boot ($(wc -l <"$OUT/applied.names")):"
		sed 's/^/    /' "$OUT/applied.names"
	fi
fi

exit "$FAILED"
