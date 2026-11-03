import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { View } from "react-native";
import { FormMessage } from "./form-message";

type SelectOption = {
  label: string;
  value: string;
};

type FormSelectProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  containerClassName?: string;
  description?: string;
  label?: string;
  name: TName;
  options: SelectOption[];
  placeholder?: string;
};

export function FormSelect<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  containerClassName,
  description,
  label,
  name,
  options,
  placeholder,
}: FormSelectProps<TFieldValues, TName>) {
  const { field, fieldState } = useController({ control, name });
  const selected = options.find((option) => option.value === (field.value as string | undefined));

  return (
    <View className={cn("gap-2", containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      <Select onValueChange={(option) => field.onChange(option?.value ?? "")} value={selected}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder ?? ""} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} label={option.label} value={option.value} />
          ))}
        </SelectContent>
      </Select>
      {description ? <Text variant="muted">{description}</Text> : null}
      <FormMessage message={fieldState.error?.message} />
    </View>
  );
}
