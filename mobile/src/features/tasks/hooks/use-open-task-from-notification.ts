import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { z } from "zod";
import { openTask } from "../components/task-row";

const taskData = z.object({ connectionId: z.string().min(1), key: z.string().min(1) });

/** Tapping a "new task" notification opens that task, also when the tap launched the app. The summary opens the list. */
export function useOpenTaskFromNotification() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const data = taskData.safeParse(response.notification.request.content.data);
    if (data.success) openTask(data.data);
    // Handled once: a later re-render must not reopen it.
    void Notifications.clearLastNotificationResponseAsync();
  }, [response]);
}
