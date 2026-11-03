import * as Network from "expo-network";

export async function getNetworkState() {
  const state = await Network.getNetworkStateAsync();

  return {
    isConnected: Boolean(state.isConnected),
    isInternetReachable: state.isInternetReachable !== false,
    isOnline: Boolean(state.isConnected) && state.isInternetReachable !== false,
    type: state.type,
  };
}

export async function getIpAddress() {
  return Network.getIpAddressAsync();
}
