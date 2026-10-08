.PHONY: setup dev preflight check db-reset eval stop

setup: preflight
	npm ci
	npx supabase start
	npx supabase db reset --local
	node scripts/env.mjs
	node --env-file=.env.local --import tsx scripts/seed.ts
	@echo ""
	@echo "Setup done. Run: make dev"

# production server, so the first search isn't waiting on route compilation
dev:
	npx next build
	npx next start -p 3000

preflight:
	@node -e 'const v=+process.versions.node.split(".")[0]; if (v<24) { console.error("Node 24 is required (found " + process.version + ")"); process.exit(1) }'
	@docker info >/dev/null 2>&1 || (echo "Docker is not running. Start Docker Desktop and try again." && exit 1)

db-reset:
	npx supabase db reset --local
	node --env-file=.env.local --import tsx scripts/seed.ts

# needs the app running (make dev)
check:
	node --env-file=.env.local --import tsx scripts/check.ts

eval:
	node --env-file=.env.local --import tsx scripts/eval.ts

stop:
	npx supabase stop
