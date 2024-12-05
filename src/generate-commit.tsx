import { ActionPanel, Detail, Form, Action, useNavigation, LocalStorage, AI } from "@raycast/api";
import { useEffect, useState } from "react";
import { exec } from "child_process";

interface ParsedCommitMessage {
  summary: string;
  details: string[];
}

function parseAIResponse(response: string): ParsedCommitMessage {
  const lines = response
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let summary = "";
  const details: string[] = [];

  const summaryIndex = lines.findIndex((line) => line.toLowerCase().includes("commit summary:"));

  if (summaryIndex !== -1 && summaryIndex + 1 < lines.length) {
    summary = lines[summaryIndex + 1].trim();
  }

  const detailsIndex = lines.findIndex((line) => line.toLowerCase().includes("commit message:"));

  if (detailsIndex !== -1) {
    const detailLines = lines.slice(detailsIndex + 1);
    details.push(
      ...detailLines
        .filter((line) => line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))
        .map((line) => {
          line = line.trim();
          if (line.startsWith("-") || line.startsWith("*")) {
            line = "•" + line.slice(1); // 標準化符號
          }
          return line;
        }),
    );
  }

  if (!summary || details.length === 0) {
    summary =
      lines.find(
        (line) =>
          !line.startsWith("•") &&
          !line.startsWith("-") &&
          !line.startsWith("*") &&
          !line.toLowerCase().includes("commit"),
      ) || "";

    details.push(
      ...lines
        .filter((line) => line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))
        .map((line) => {
          line = line.trim();
          if (line.startsWith("-") || line.startsWith("*")) {
            line = "•" + line.slice(1);
          }
          return line;
        }),
    );
  }

  return { summary, details };
}

export default function Command() {
  const { push } = useNavigation();
  const [gitPath, setGitPath] = useState<string>("");
  const [savedPaths, setSavedPaths] = useState<string[]>([]);

  useEffect(() => {
    async function fetchPaths() {
      const pathsString = (await LocalStorage.getItem<string>("gitPaths")) || "[]";
      try {
        const paths = JSON.parse(pathsString) as string[];
        setSavedPaths(paths);
      } catch (error) {
        console.error("Error parsing saved paths:", error);
        setSavedPaths([]);
      }
    }
    fetchPaths();
  }, []);

  function handleSubmit() {
    push(<GenerateCommitMessage gitPath={gitPath} />);
  }

  function formatPath(path: string) {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(-2).join("/") : path;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Generate Commit Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="gitPath" title="Git Repository Path" value={gitPath} onChange={setGitPath}>
        {savedPaths.map((path) => (
          <Form.Dropdown.Item key={path} value={path} title={formatPath(path)} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

function GenerateCommitMessage({ gitPath }: { gitPath: string }) {
  const [gitDiff, setGitDiff] = useState<string>("");
  const [commitMessage, setCommitMessage] = useState<ParsedCommitMessage | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    exec(`git -C "${gitPath}" diff`, (error, stdout) => {
      if (error) {
        console.error("Error executing git diff:", error);
        return;
      }
      setGitDiff(stdout);
    });
  }, [gitPath]);

  useEffect(() => {
    if (!gitDiff) return;

    const prompt = `
Generate a Git commit message for the following diff. Format your response EXACTLY as follows:

Commit Summary:
[One line summary in imperative mood, max 50 chars]

Commit Message:
• [First detail point]
• [Second detail point]
• [Additional points as needed]

Rules:
1. Summary MUST be in imperative mood (e.g., "Add", "Fix", "Update")
2. Summary should be specific and meaningful
3. Detail points should explain what changed and why
4. Each detail MUST start with a bullet point (•)
5. Each detail should be on a new line
6. Keep details concise but informative

Git diff content:
${gitDiff}

Remember: Format the response EXACTLY as shown above, with "Commit Summary:" and "Commit Message:" labels.
`;

    setIsLoading(true);
    AI.ask(prompt, { creativity: 0, model: AI.Model.Anthropic_Claude_Sonnet })
      .then((response) => {
        const parsed = parseAIResponse(response);
        setCommitMessage(parsed);
        console.log("[AI_RESPONSE] Parsed result:", parsed);
        console.log("[PARSE_RESULT] Markdown formatted successfully:", parsed);
      })
      .catch((error) => {
        console.error("Error generating commit message:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [gitDiff]);

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle="Commit Message Preview"
      markdown={
        commitMessage
          ? `
# Commit Summary
${commitMessage.summary}

---

# Commit Message
${commitMessage.details.map((detail) => `- ${detail.replace(/^•\s*/, "")}`).join("\n")}
          `
          : "Generating commit message..."
      }
    />
  );
}
