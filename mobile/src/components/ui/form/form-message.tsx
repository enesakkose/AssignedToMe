import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type FormMessageProps = {
  className?: string;
  message?: string;
};

export function FormMessage({ className, message }: FormMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <Text className={cn("text-destructive text-sm", className)} variant="default">
      {message}
    </Text>
  );
}
