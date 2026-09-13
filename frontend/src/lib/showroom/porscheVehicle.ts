// The one catalog slug with a real GLB behind it (see PorscheShowroomRig.tsx /
// PorscheModelPreview.tsx) — not a "use client" module, so both the server-rendered
// /models page and the client-only showroom rig can import this one source of truth
// without crossing the server/client boundary just to read a string constant.
export const PORSCHE_GT3_R_SLUG = "porsche-992-gt3-r";
