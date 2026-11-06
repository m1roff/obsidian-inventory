# Release helper. Usage: make release VERSION=0.1.2
#
# Checks the code the same way the release workflow does, sets the version in every file
# that carries it, commits that, tags it and pushes the branch and the tag. The tag starts
# the release workflow on GitHub, which builds the plugin and creates a DRAFT release:
# publish it by hand there.

.PHONY: release

release:
	@test -n "$(VERSION)" || { echo "Usage: make release VERSION=x.y.z" >&2; exit 1; }
	@echo "$(VERSION)" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$$' || { echo "VERSION must look like 1.2.3" >&2; exit 1; }
	@test -z "$$(git status --porcelain)" || { echo "The working tree is not clean: commit or stash first." >&2; exit 1; }
	@git rev-parse -q --verify "refs/tags/$(VERSION)" >/dev/null && { echo "Tag $(VERSION) already exists." >&2; exit 1; } || true
	docker compose run --rm -T build node tools/bump-version.mjs $(VERSION)
	docker compose run --rm -T build sh -c "npm run typecheck && npm test && npm run lint"
	git add manifest.json package.json package-lock.json versions.json
	@git diff --cached --quiet || git commit -m "Release $(VERSION)"
	git tag $(VERSION)
	git push origin HEAD
	git push origin $(VERSION)
