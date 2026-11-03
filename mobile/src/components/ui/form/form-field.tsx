import {
  useController,
  type Control,
  type FieldPath,
  type FieldValues,
  type UseControllerReturn,
} from "react-hook-form";

type FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  children: (controller: UseControllerReturn<TFieldValues, TName>) => React.ReactNode;
};

export function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  children,
  control,
  name,
}: FormFieldProps<TFieldValues, TName>) {
  const controller = useController({ control, name });
  return <>{children(controller)}</>;
}
