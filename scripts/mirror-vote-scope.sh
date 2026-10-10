#!/bin/bash
# Refresh the Vote-Scope mirror (data-mirror branch) from this machine.
#   npm run data:mirror
# Vote-Scope's Cloudflare blocks Vercel, GitHub and cloud runners, so the site reads this mirror when the
# source refuses it (src/lib/vote-scope.ts). Nothing is left behind: the branch is cloned into a temporary
# folder, updated, pushed and deleted.
set -euo pipefail

REPO="$(git -C "$(dirname "$0")/.." remote get-url origin)"
FILES="us-house/latest.json us-senate/latest.json us-house/polls/index.json us-senate/polls/index.json"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone --quiet --single-branch --branch data-mirror --depth 1 "$REPO" "$WORK/mirror"
cd "$WORK/mirror"

for file in $FILES; do
  curl -sfL --retry 2 "https://vote-scope.com/web_data/$file" -o "$WORK/download.json"
  # Keep only real data: never overwrite the mirror with an error or challenge page.
  node -e 'const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!d.meta) process.exit(1)' "$WORK/download.json"
  mkdir -p "vote-scope/$(dirname "$file")"
  mv "$WORK/download.json" "vote-scope/$file"
done

run_date="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("vote-scope/us-house/latest.json", "utf8")).meta.run_date)')"
git add -A
if git diff --cached --quiet; then
  echo "Mirror already current (Vote-Scope run $run_date)."
  exit 0
fi
git -c user.name="midterm-pulse-mirror" -c user.email="actions@users.noreply.github.com" commit --quiet -m "Mirror Vote-Scope run $run_date"
git push --quiet
echo "Mirror updated to Vote-Scope run $run_date."
