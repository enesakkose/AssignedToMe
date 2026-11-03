import { exampleItemsSchema } from "@/features/example/schemas/example-schema";
import type { ExampleItem } from "@/features/example/types";

const mockItems: ExampleItem[] = [
  { id: "example-1", owner: "Product", status: "ready", title: "Feature screen" },
  { id: "example-2", owner: "Design", status: "draft", title: "Local components" },
  { id: "example-3", owner: "Platform", status: "archived", title: "Feature hooks" },
];

export async function getExampleItems() {
  await new Promise((resolve) => setTimeout(resolve, 180));

  return exampleItemsSchema.parse(mockItems);
}
