import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { View } from "react-native";
import { FormMessage } from "./form-message";

type FormInputProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  containerClassName?: string;
  description?: string;
  label?: string;
  name: TName;
} & Omit<React.ComponentProps<typeof Input>, "onBlur" | "onChangeText" | "value">;

export function FormInput<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  containerClassName,
  description,
  label,
  name,
  ...inputProps
}: FormInputProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <View className={cn("gap-2", containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      <Input
        {...inputProps}
        onBlur={field.onBlur}
        onChangeText={field.onChange as (text: string) => void}
        value={field.value as string}
      />
      {description ? <Text variant="muted">{description}</Text> : null}
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
