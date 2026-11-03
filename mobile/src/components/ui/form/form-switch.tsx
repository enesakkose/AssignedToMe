import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { View } from "react-native";
import { FormMessage } from "./form-message";

type FormSwitchProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  containerClassName?: string;
  description?: string;
  label?: string;
  name: TName;
};

export function FormSwitch<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ control, containerClassName, description, label, name }: FormSwitchProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });

  return (
    <View className={cn("gap-2", containerClassName)}>
      <View className="flex-row items-center gap-3">
        <Switch
          checked={field.value as boolean}
          onCheckedChange={field.onChange as (value: boolean) => void}
        />
        {label ? <Label>{label}</Label> : null}
      </View>
      {description ? <Text variant="muted">{description}</Text> : null}
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
