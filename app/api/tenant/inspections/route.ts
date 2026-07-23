import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyRoom } from "@/lib/classify-room";
import { isRoom } from "@/lib/rooms";
import { getApplicant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
// Uploading + room-labeling several photos can take a while.
export const maxDuration = 60;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15 MB, keeps the AI call within limits
// Videos skip the AI, so only transfer time matters. Note: on Vercel,
// serverless request bodies are capped around 4.5 MB, so large videos
// need self-hosting (or, as a future improvement, browser-direct
// uploads via createSignedUploadUrl). Same precedent as the documents
// route, which already allows 15 MB.
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

// Uploads pre-move-in inspection media for the signed-in applicant.
// Photos are stored then room-labeled by the AI (when configured);
// videos carry the room the applicant picked in the form (the "rooms"
// field is index-aligned with "files": the chosen room for videos, ""
// for photos and unlabeled videos).
export async function POST(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter(
    (f): f is File => f instanceof File
  );
  const rooms = (form?.getAll("rooms") ?? []).map((r) => {
    const value = String(r).trim();
    return isRoom(value) ? value : "";
  });

  if (files.length === 0) {
    return NextResponse.json({ error: "No files sent" }, { status: 400 });
  }
  for (const file of files) {
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          error: `"${file.name}": only PNG, JPEG, and WebP images and MP4, WebM, and MOV videos are supported.`,
        },
        { status: 400 }
      );
    }
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `"${file.name}" is too large (max 15 MB for photos).` },
        { status: 400 }
      );
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: `"${file.name}" is too large (max 50 MB for videos).` },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminClient();

  // Stage 1 (parallel): store the file and, for photos, label the room.
  const staged = await Promise.all(
    files.map(async (file, index) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `inspections/${applicant.id}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, buffer, { contentType: file.type });
      if (uploadError) {
        return {
          file: file.name,
          error: uploadError.message,
          filePath: "",
          mimeType: file.type,
          room: null as string | null,
          name: file.name,
        };
      }

      const isImage = IMAGE_TYPES.includes(file.type);
      const classification = isImage
        ? await classifyRoom(buffer, file.type)
        : null;

      return {
        file: file.name,
        error: "",
        filePath,
        mimeType: file.type,
        room: isImage ? (classification?.room ?? null) : rooms[index] || null,
        name: classification?.caption || file.name,
      };
    })
  );

  // Stage 2 (serial): save the rows.
  const results: { file: string; error?: string }[] = [];
  for (const item of staged) {
    if (item.error) {
      results.push({ file: item.file, error: item.error });
      continue;
    }

    const { error: insertError } = await supabase
      .from("inspection_media")
      .insert({
        applicant_id: applicant.id,
        name: item.name,
        room: item.room,
        file_path: item.filePath,
        mime_type: item.mimeType,
      });

    if (insertError) {
      await supabase.storage.from("documents").remove([item.filePath]);
      results.push({ file: item.file, error: "could not be saved" });
      continue;
    }
    results.push({ file: item.file });
  }

  const failed = results.filter((r) => "error" in r && r.error);
  if (failed.length > 0) {
    return NextResponse.json(
      {
        error: `Some files failed: ${failed
          .map((f) => `${f.file} (${f.error})`)
          .join(", ")}`,
        uploaded: results.length - failed.length,
      },
      { status: failed.length === results.length ? 500 : 207 }
    );
  }

  return NextResponse.json({ ok: true, uploaded: results.length });
}

// Deletes one of the applicant's own inspection photos/videos.
export async function DELETE(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const mediaId = String(body?.mediaId ?? "");
  if (!mediaId) {
    return NextResponse.json({ error: "Missing mediaId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: media } = await supabase
    .from("inspection_media")
    .select("id, file_path")
    .eq("id", mediaId)
    .eq("applicant_id", applicant.id)
    .maybeSingle();

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  await supabase.from("inspection_media").delete().eq("id", media.id);
  await supabase.storage.from("documents").remove([media.file_path]);

  return NextResponse.json({ ok: true });
}
