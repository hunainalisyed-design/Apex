# Apex
Premium 3D car configurator built with React, Three.js &amp; React Three Fiber. Real-time paint/wheel/interior customization, dynamic pricing, an AI configuration assistant (CarAI), save &amp; share builds, and vehicle comparison — full-stack portfolio project with Node.js, Express, and Prisma/PostgreSQL.
APEX — 3D Vehicle Configurator

APEX is a full-stack, AI-integrated 3D vehicle configuration platform designed as a premium automotive digital showroom. The application allows users to explore, customize, and price a vehicle in real time through an interactive Three.js–powered 3D scene, supported by a natural-language AI assistant, dynamic pricing engine, and shareable build configurations.

Core Capabilities

Interactive 3D showroom with real-time camera controls, component highlighting, and cinematic scene transitions
Live customization of paint, wheels, brake calipers, and interior materials, with instant 3D and pricing updates
CarAI, a natural-language assistant that interprets requests (e.g., "give me a luxury configuration under €100,000") and returns a validated, structured recommendation the user can apply directly to the vehicle
Persistent, shareable build configurations with unique identifiers
Side-by-side vehicle comparison
Secure, backend-proxied AI integration with no client-exposed API keys

Technical Stack

Layer	Technologies
Frontend:	Next.js (React), Three.js, React Three Fiber, Tailwind CSS, GSAP, Framer Motion
Backend:	Node.js, Express
Database:	PostgreSQL (Prisma ORM)
AI Integration:	Claude API (server-side proxy)

This project was built to demonstrate full-stack engineering, real-time 3D rendering, and applied AI integration in a single, cohesive, production-oriented codebase.

> Next.js replaces the Vite frontend originally listed in the SRS — needed for per-build dynamic Open Graph images (see `docs/specs/README.md`).

## Getting Started

**Prerequisites:** Node.js 24+, npm, [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Postgres).

```bash
# 1. Start Postgres
docker compose up -d

# 2. Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Install dependencies (root install covers both workspaces)
npm install

# 4. Run both apps in dev mode
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend health check: [http://localhost:4000/api/health](http://localhost:4000/api/health)

Other useful commands (run from the repo root, apply to both workspaces):

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

The backend's DB-dependent integration test runs separately once Postgres is up:

```bash
npm run test:integration --workspace=backend
```

See `docs/CLAUDE.md` for the project's spec-first workflow and architectural conventions, and `docs/specs/` for the full feature spec index.
