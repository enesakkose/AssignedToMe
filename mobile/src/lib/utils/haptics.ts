import * as Haptics from "expo-haptics";
import { type GestureResponderEvent } from "react-native";

export const HAPTIC_FEEDBACK = {
  error: "error",
  heavy: "heavy",
  light: "light",
  medium: "medium",
  selection: "selection",
  success: "success",
  warning: "warning",
} as const;

export type HapticFeedback = (typeof HAPTIC_FEEDBACK)[keyof typeof HAPTIC_FEEDBACK];

export const hapticSelection = () => Haptics.selectionAsync();

export const hapticImpact = (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) => {
  return Haptics.impactAsync(style);
};

export const hapticNotification = (
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
) => {
  return Haptics.notificationAsync(type);
};

export const hapticLight = () => hapticImpact(Haptics.ImpactFeedbackStyle.Light);

export const hapticMedium = () => hapticImpact(Haptics.ImpactFeedbackStyle.Medium);

export const hapticHeavy = () => hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);

export const hapticSuccess = () => hapticNotification(Haptics.NotificationFeedbackType.Success);

export const hapticWarning = () => hapticNotification(Haptics.NotificationFeedbackType.Warning);

export const hapticError = () => hapticNotification(Haptics.NotificationFeedbackType.Error);

export function triggerHapticFeedback(feedback: HapticFeedback = HAPTIC_FEEDBACK.selection) {
  switch (feedback) {
    case HAPTIC_FEEDBACK.error:
      return hapticError();
    case HAPTIC_FEEDBACK.heavy:
      return hapticHeavy();
    case HAPTIC_FEEDBACK.light:
      return hapticLight();
    case HAPTIC_FEEDBACK.medium:
      return hapticMedium();
    case HAPTIC_FEEDBACK.success:
      return hapticSuccess();
    case HAPTIC_FEEDBACK.warning:
      return hapticWarning();
    case HAPTIC_FEEDBACK.selection:
    default:
      return hapticSelection();
  }
}

export function withHapticFeedback(
  onPress?: ((event: GestureResponderEvent) => void) | null,
  feedback: HapticFeedback | false = HAPTIC_FEEDBACK.selection,
) {
  if (!onPress) {
    return undefined;
  }

  return (event: GestureResponderEvent) => {
    if (feedback) {
      void triggerHapticFeedback(feedback).catch(() => undefined);
    }

    onPress(event);
  };
}
