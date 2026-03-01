#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ "$SEED_ON_STARTUP" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting server..."
exec node server.js
