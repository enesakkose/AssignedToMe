export type ExampleItemStatus = "draft" | "ready" | "archived";

export type ExampleItem = {
  id: string;
  owner: string;
  status: ExampleItemStatus;
  title: string;
};
