// Rooms/parts of the house an inspection photo or video can show.
// Shared by the AI classifier (server) and the room dropdown for
// videos (client), so keep this file dependency-free.

export const ROOMS = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living room",
  "Dining room",
  "Laundry",
  "Garage",
  "Hallway",
  "Exterior",
  "Backyard / Garden",
  "Balcony",
  "Other",
] as const;

export type Room = (typeof ROOMS)[number];

export function isRoom(value: unknown): value is Room {
  return typeof value === "string" && (ROOMS as readonly string[]).includes(value);
}
