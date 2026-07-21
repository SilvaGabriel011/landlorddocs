// Classifies an uploaded document with the OpenAI API so the landlord
// sees a per-person summary like "Pay stub × 2 · Bank statement × 1".
// Entirely optional: when OPENAI_API_KEY is not set (or the call fails),
// uploads still work and the document is stored without a category.

export const DOC_TYPES = [
  "ID document",
  "Pay stub",
  "Bank statement",
  "Tax return",
  "Employment letter",
  "Reference letter",
  "Utility bill",
  "Rental history",
  "Credit report",
  "Other",
] as const;

export type Classification = {
  docType: (typeof DOC_TYPES)[number];
  title: string;
};

const PROMPT = `You are helping organize documents in a rental application.
Look at the attached document and reply with ONLY a JSON object, no other text:
{"docType": "<one of: ${DOC_TYPES.join(", ")}>", "title": "<short descriptive title for this document, max 60 characters, e.g. 'Pay stub — June 2026' or 'Driver's license — John Smith'>"}`;

export async function classifyDocument(
  file: Buffer,
  mimeType: string,
  filename: string
): Promise<Classification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const dataUrl = `data:${mimeType};base64,${file.toString("base64")}`;

  const filePart =
    mimeType === "application/pdf"
      ? { type: "input_file", filename, file_data: dataUrl }
      : { type: "input_image", image_url: dataUrl };

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
            content: [{ type: "input_text", text: PROMPT }, filePart],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("OpenAI classification failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const text = extractOutputText(data);
    if (!text) return null;

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    const docType = DOC_TYPES.includes(parsed.docType)
      ? parsed.docType
      : "Other";
    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 80)
        : "";

    return { docType, title };
  } catch (err) {
    console.error("OpenAI classification failed:", err);
    return null;
  }
}

// The Responses API returns output as a list of items; find the text.
function extractOutputText(data: unknown): string | null {
  const d = data as {
    output_text?: string;
    output?: {
      type: string;
      content?: { type: string; text?: string }[];
    }[];
  };
  if (typeof d.output_text === "string") return d.output_text;
  for (const item of d.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  return null;
}
