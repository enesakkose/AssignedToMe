import { Image, View } from "react-native";

// The same picture as the native splash (app.json → expo-splash-screen): the logo tile on the theme's paper, at the
// same width, so handing over from the native splash to this view doesn't move anything.
const LOGO = require("../../../../assets/images/splash-icon.png");

export function SplashScreenView() {
  return (
    <View
      accessibilityLabel="AssignedToMe"
      className="flex-1 items-center justify-center bg-background"
    >
      <Image source={LOGO} style={{ height: 96, width: 96 }} />
    </View>
  );
}
