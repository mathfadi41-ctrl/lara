.PHONY: install env-init dev-frontend dev-backend dev-ai docker-up docker-down

install:
	npm install

env-init:
	npm run env:init

dev-frontend:
	npm run dev:frontend

dev-backend:
	npm run dev:backend

dev-ai:
	npm run dev:ai

docker-up:
	docker compose up --build

docker-down:
	docker compose down --remove-orphans
