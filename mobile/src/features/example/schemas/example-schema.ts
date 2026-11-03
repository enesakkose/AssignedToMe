import { z } from "zod";

export const exampleItemSchema = z.object({
  id: z.string(),
  owner: z.string().min(1),
  status: z.enum(["draft", "ready", "archived"]),
  title: z.string().min(1),
});

export const exampleItemsSchema = z.array(exampleItemSchema);
