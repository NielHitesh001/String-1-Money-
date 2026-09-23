#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_name="corpgraph-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$project_dir/backups"
cd "$project_dir"

restart_neo4j() {
    docker compose up -d --wait neo4j
}
trap restart_neo4j EXIT INT TERM
docker compose stop neo4j
BACKUP_NAME="$backup_name" docker compose --profile ops run --rm volume-backup
restart_neo4j
trap - EXIT INT TERM
sha256sum "backups/$backup_name.tar.gz" > "backups/$backup_name.tar.gz.sha256"
echo "Created backups/$backup_name.tar.gz"
