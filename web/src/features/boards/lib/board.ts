/** A connected board as the screens see it: a stable id, its display name and the provider it comes from. */
export type Board = {
  id: string;
  name: string;
  providerId: string;
  /** It could not be loaded (its sign-in ended, its site is down…): the screen shows the error instead of tasks. */
  signedOut?: boolean;
  /** Why, as the server reported it: a code and HTTP status, never a message. */
  error?: { code: string; status?: number };
};
