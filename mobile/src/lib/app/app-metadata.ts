import Constants from "expo-constants";
import * as Application from "expo-application";
import * as Device from "expo-device";

function readRuntimeVersion() {
  const runtimeVersion = Constants.expoConfig?.runtimeVersion;

  if (!runtimeVersion) {
    return null;
  }

  return typeof runtimeVersion === "string" ? runtimeVersion : runtimeVersion.policy;
}

export const appMetadata = {
  buildNumber: Application.nativeBuildVersion ?? "development",
  bundleIdentifier: Application.applicationId ?? "development",
  device: {
    brand: Device.brand,
    isDevice: Device.isDevice,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    osName: Device.osName,
    osVersion: Device.osVersion,
  },
  name: Application.applicationName ?? Constants.expoConfig?.name ?? "rn-base",
  runtimeVersion: readRuntimeVersion(),
  version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "1.0.0",
};
