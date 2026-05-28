// /app/c/{id} dynamic route — same React component as /app, just rendered
// at a clean opaque URL. The conversation id is read from window.location
// inside the page component (we use the existing usePathname() machinery,
// not the segment params, so the page logic stays in a single file rather
// than being duplicated here).
//
// V1: sessionStorage-backed (see lib/conv-id.ts).
// V2 (AGG-44): Supabase-backed conversations + share URLs.

export { default } from "../../page";
