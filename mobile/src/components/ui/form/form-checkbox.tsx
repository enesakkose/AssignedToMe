import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { View } from "react-native";
import { FormMessage } from "./form-message";

type FormCheckboxProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  containerClassName?: string;
  description?: string;
  label?: string;
  name: TName;
};

export function FormCheckbox<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  containerClassName,
  description,
  label,
  name,
}: FormCheckboxProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <View className={cn("gap-2", containerClassName)}>
      <View className="flex-row items-center gap-3">
        <Checkbox
          checked={field.value as boolean}
          onCheckedChange={(value) => field.onChange(value === true)}
        />
        {label ? <Label>{label}</Label> : null}
      </View>
      {description ? <Text variant="muted">{description}</Text> : null}
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
