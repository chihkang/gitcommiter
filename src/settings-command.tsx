import { ActionPanel, Form, Action, LocalStorage, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";

export default function SettingsCommand() {
  const [repoPath, setRepoPath] = useState<string>("");
  const [shortcut, setShortcut] = useState<string>("");
  const [configurations, setConfigurations] = useState<{ path: string; shortcut: string }[]>([]);

  useEffect(() => {
    async function fetchConfigurations() {
      const storedConfigs = await LocalStorage.getItem<string>("repoConfigurations");
      if (storedConfigs) {
        setConfigurations(JSON.parse(storedConfigs));
      }
    }
    fetchConfigurations();
  }, []);

  async function handleSubmit() {
    const newConfig = { path: repoPath, shortcut };
    const updatedConfigurations = [...configurations, newConfig];
    setConfigurations(updatedConfigurations);
    await LocalStorage.setItem("repoConfigurations", JSON.stringify(updatedConfigurations));
    showToast(Toast.Style.Success, "Configuration Saved");
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Configuration" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="repoPath"
        title="Repository Path"
        placeholder="Enter the Git repository path"
        value={repoPath}
        onChange={setRepoPath}
      />
      <Form.TextField
        id="shortcut"
        title="Shortcut"
        placeholder="Enter a shortcut (e.g., cmd+shift+1)"
        value={shortcut}
        onChange={setShortcut}
      />
    </Form>
  );
}
