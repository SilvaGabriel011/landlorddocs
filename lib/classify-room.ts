// Labels a pre-move-in inspection photo with the room it shows, using
// the OpenAI API, so the gallery groups photos by "Kitchen",
// "Bathroom", ... automatically. Videos never come through here — the
// applicant picks their room manually at upload. Entirely optional:
// when OPENAI_API_KEY is not set (or the call fails), uploads still
// work and the photo is stored unlabeled.

import { extractOutputText } from "@/lib/classify";
import { ROOMS, type Room, isRoom } from "@/lib/rooms";

export type RoomClassification = {
  room: Room;
  // Short label for the photo; "" when the model gave none.
  caption: string;
};

const PROMPT = `You are helping organize pre-move-in inspection photos of a rental
property. Look at the attached photo and reply with ONLY a JSON object,
no other text:
{"room": "<one of: ${ROOMS.join(", ")}>", "caption": "<short label for the photo, max 60 characters, e.g. 'Kitchen — bench top and sink' or 'Bathroom — mould above shower'>"}

Pick the room or part of the house the photo mainly shows. Use
"Exterior" for the facade/front/side of the building, "Backyard /
Garden" for outdoor areas, and "Other" when you cannot tell.`;

export async function classifyRoom(
  file: Buffer,
  mimeType: string
): Promise<RoomClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const dataUrl = `data:${mimeType};base64,${file.toString("base64")}`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: dataUrl },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("OpenAI room classification failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const text = extractOutputText(data);
    if (!text) return null;

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const room: Room = isRoom(parsed.room) ? parsed.room : "Other";
    const caption =
      typeof parsed.caption === "string" && parsed.caption.trim()
        ? parsed.caption.trim().slice(0, 80)
        : "";

    return { room, caption };
  } catch (err) {
    console.error("OpenAI room classification failed:", err);
    return null;
  }
}
