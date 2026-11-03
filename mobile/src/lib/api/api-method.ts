export const API_METHOD = {
  delete: "DELETE",
  get: "GET",
  patch: "PATCH",
  post: "POST",
  put: "PUT",
} as const;

export type ApiMethod = (typeof API_METHOD)[keyof typeof API_METHOD];
