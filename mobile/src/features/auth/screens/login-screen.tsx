import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { zodResolver } from "@hookform/resolvers/zod";
import { OTPInput } from "input-otp-native";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { toast } from "sonner-native";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginScreen() {
  const form = useForm<LoginForm>({
    defaultValues: {
      email: "",
      otp: "",
    },
    resolver: zodResolver(loginSchema),
  });

  function onSubmit(values: LoginForm) {
    toast.success("Login form is valid", {
      description: `${values.email} can continue with ${values.otp}.`,
    });
  }

  return (
    <Screen>
      <AppHeader
        subtitle="Generic React Hook Form + Zod example with a native OTP input."
        title="Login"
      />

      <Section title="Credentials">
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <View className="gap-2">
              <Label nativeID="email">Email</Label>
              <Input
                aria-labelledby="email"
                autoCapitalize="none"
                keyboardType="email-address"
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="hello@company.com"
                value={field.value}
              />
              {fieldState.error ? <Text variant="muted">{fieldState.error.message}</Text> : null}
            </View>
          )}
        />

        <Controller
          control={form.control}
          name="otp"
          render={({ field, fieldState }) => (
            <View className="gap-2">
              <Label>One-time password</Label>
              <OTPInput
                keyboardType="number-pad"
                maxLength={6}
                onChange={field.onChange}
                value={field.value}
                render={({ slots }) => (
                  <View className="flex-row gap-2">
                    {slots.map((slot, index) => (
                      <Button
                        className="h-12 w-11 border-border bg-background"
                        key={index}
                        onPress={slot.focus}
                        variant={slot.isActive ? "default" : "outline"}
                      >
                        <Text>{slot.char ?? slot.placeholderChar ?? ""}</Text>
                      </Button>
                    ))}
                  </View>
                )}
              />
              {fieldState.error ? <Text variant="muted">{fieldState.error.message}</Text> : null}
            </View>
          )}
        />

        <Button onPress={form.handleSubmit(onSubmit)}>
          <Text>Validate login</Text>
        </Button>
      </Section>
    </Screen>
  );
}
