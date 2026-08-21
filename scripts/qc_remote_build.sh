#!/usr/bin/env bash
set -euo pipefail

cd /srv/geosains/app

swapped_uploads=0
if [ -L public/uploads ]; then
  mv public/uploads public/uploads.__build_symlink__
  mkdir public/uploads
  swapped_uploads=1
fi

swapped_storage=0
if [ -L storage ]; then
  mv storage storage.__build_symlink__
  mkdir -p storage/lessons storage/uploads
  swapped_storage=1
fi

cleanup() {
  if [ "$swapped_uploads" -eq 1 ]; then
    rmdir public/uploads 2>/dev/null || true
    mv public/uploads.__build_symlink__ public/uploads
  fi
  if [ "$swapped_storage" -eq 1 ]; then
    rm -rf storage
    mv storage.__build_symlink__ storage
  fi
}

trap cleanup EXIT

npm run build