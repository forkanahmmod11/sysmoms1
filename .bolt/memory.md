# Project memory

## Product intent & audience

- Enterprise-grade office management web application
- Core features: real-time chat, video calling, task management, dynamic dashboards, role-based access control
- Three user roles: admins, moderators, employees — each with different permissions and UI access
- Target: organizations needing an all-in-one internal operations platform

## Brand personality & voice

- Professional, enterprise-grade tone
- Modern and polished; production-quality feel
- Functional but visually distinctive — not generic or template-like

## Visual design & UX direction

- Framer Motion for animations and transitions
- Lucide React for all icons and logos
- Tailwind CSS v4 (configured via CSS `@theme` block, not JS config)
- `@/` path alias for imports (maps to `src/`)
- Aesthetic should be beautiful and non-cookie-cutter per project standards
- UI must reflect role-based variations (admin vs moderator vs employee views)

## Decisions, constraints & rationale

- Framework: Vite + React (not Next.js, despite project summary mention)
- Vite 8 with built-in `resolve.tsconfigPaths: true` — preserve as-is
- Database: Supabase (already integrated in project)
- No additional storage packages or UI theme/icon libraries beyond what's provided
- Current blocker: Supabase database connection not reachable from Bolt; awaiting user reconnect before proceeding with DB creation/schema work
- Decision to not add alternative storage while Supabase is disconnected

## Open questions & assumptions

- Database schema not yet defined — needs to be created once connection is restored
- Assumption: Supabase will provide auth, realtime, and storage capabilities for chat/video features
- Unclear: exact data models for tasks, users, roles, chat messages, call records, dashboard metrics
- Unclear: whether video calling uses a third-party SDK (WebRTC, Twilio, etc.) or is self-implemented
- Pending: database reconnection before any DB-related work can proceed