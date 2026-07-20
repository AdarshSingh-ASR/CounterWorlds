import { getWorldArtifact } from "../../../../lib/classroom-store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const object = await getWorldArtifact(slug);
  if (!object) return new Response("World artifact not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      // Storage can return a string upload as a text/plain Blob even when its
      // metadata says text/html. This route only serves validator-approved
      // world artifacts, so the rendering contract must be explicit.
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=300",
    },
  });
}
