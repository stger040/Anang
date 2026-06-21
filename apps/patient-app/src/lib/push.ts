import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getStoredToken } from "./api";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://app.anang.ai";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  if (!token) return;

  const storedToken = await getStoredToken();
  if (!storedToken) return;

  await fetch(`${BASE_URL}/api/patient/push-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${storedToken}`,
    },
    body: JSON.stringify({ token }),
  }).catch(() => {/* best-effort */});
}
