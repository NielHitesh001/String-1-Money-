#!/bin/sh
set -eu

if [ "$#" -ne 2 ] || [ "$2" != "--confirm" ]; then
    echo "Usage: $0 backups/corpgraph-TIMESTAMP.tar.gz --confirm" >&2
    exit 2
fi

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
archive=$(basename -- "$1")
case "$archive" in
    corpgraph-[0-9]*T[0-9]*Z.tar.gz) ;;
    *) echo "Refusing unexpected backup filename" >&2; exit 2 ;;
esac
test -f "$project_dir/backups/$archive"
cd "$project_dir"

restart_neo4j() {
    docker compose up -d --wait neo4j
}
trap restart_neo4j EXIT INT TERM
docker compose stop neo4j
BACKUP_FILE="$archive" docker compose --profile ops run --rm volume-restore
restart_neo4j
trap - EXIT INT TERM
echo "Restored $archive"
