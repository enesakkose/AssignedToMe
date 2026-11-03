import { type ReactNode } from "react";
import {
  FormProvider,
  useFormContext,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

type FormProps<TFieldValues extends FieldValues> = {
  children: ReactNode;
  form: UseFormReturn<TFieldValues>;
};

export function Form<TFieldValues extends FieldValues>({
  children,
  form,
}: FormProps<TFieldValues>) {
  return <FormProvider {...form}>{children}</FormProvider>;
}

export { useFormContext as useFormField };
