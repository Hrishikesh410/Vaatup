export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
  /** Raw, as typed by the user. Normalized only when building a WhatsApp link. */
  phone?: string;
}
