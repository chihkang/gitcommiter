import { ActionPanel, Detail, Form, Action, useNavigation, LocalStorage, AI } from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useState } from "react";
import { exec } from "child_process";

// 定義類型以提高代碼可維護性
interface GenerateCommitMessageProps {
  gitPath: string;
}

// 提取常量以便於維護和重用
const STORAGE_KEY = "gitPaths";
const DEFAULT_PATHS: string[] = [];

export default function Command() {
  const { push } = useNavigation();
  const [gitPath, setGitPath] = useState<string>("");
  const [savedPaths, setSavedPaths] = useState<string[]>(DEFAULT_PATHS);

  useEffect(() => {
    async function fetchPaths() {
      try {
        const pathsString = (await LocalStorage.getItem<string>(STORAGE_KEY)) || JSON.stringify(DEFAULT_PATHS);
        const paths = JSON.parse(pathsString) as string[];
        setSavedPaths(paths);
      } catch (error) {
        console.error("Error parsing saved paths:", error);
        setSavedPaths(DEFAULT_PATHS);
      }
    }
    fetchPaths();
  }, []);

  const handleSubmit = () => {
    push(<GenerateCommitMessage gitPath={gitPath} />);
  };

  const formatPath = (path: string): string => {
    const parts = path.split("/");
    return parts.length > 1 ? parts.slice(-2).join("/") : path;
  };

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

// 提取提示文本為常量
const COMMIT_PROMPT = `
You are a Git commit message generator. Given the git diff content below, generate a concise and descriptive commit message following these rules:

1. Summary line (50 chars or less):
- Start with a capital letter
- Use imperative mood ("Add", "Fix", "Update", not "Added", "Fixed", "Updated")
- No period at the end
- Be specific and meaningful

2. Detailed description (72 chars per line):
- Leave one blank line after summary
- Explain what and why vs. how
- List major changes with bullet points
- Include relevant issue/ticket numbers
- Explain breaking changes if any

Git diff content:
`;

// 提取訊息解析邏輯為獨立函數
const parseCommitMessage = (data: string) => {
  const lines = data
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let summary = "";
  let messages: string[] = [];

  // 尋找摘要
  const explicitSummaryIndex = lines.findIndex((line) => 
    line.toLowerCase().startsWith("commit summary:")
  );

  if (explicitSummaryIndex !== -1) {
    summary = lines[explicitSummaryIndex].replace(/^commit summary:/i, "").trim();
  } else {
    summary = lines.find((line) => 
      line && 
      !line.startsWith("-") && 
      !line.startsWith("•") && 
      !line.startsWith("*") &&
      !line.toLowerCase().includes("by:") &&
      !line.toLowerCase().includes("commit message")
    ) || "";
  }

  // 尋找訊息部分
  const messageStart = lines.findIndex((line) => 
    line.toLowerCase().includes("by:") || 
    line.startsWith("-") || 
    line.startsWith("•") || 
    line.startsWith("*")
  );

  if (messageStart !== -1) {
    messages = lines
      .slice(messageStart)
      .filter((line) => 
        line.startsWith("-") || 
        line.startsWith("•") || 
        line.startsWith("*")
      );
  }

  // 確保摘要存在
  if (!summary && messages.length > 0) {
    summary = messages[0].replace(/^[-•*]\s*/, "");
    messages = messages.slice(1);
  }

  return { summary, messages };
};

function GenerateCommitMessage({ gitPath }: GenerateCommitMessageProps) {
  const [gitDiff, setGitDiff] = useState<string>("");

  useEffect(() => {
    const getGitDiff = async () => {
      try {
        exec(`git -C "${gitPath}" diff`, (error, stdout) => {
          if (error) {
            console.error(`Git diff error:`, error);
            return;
          }
          setGitDiff(stdout);
        });
      } catch (error) {
        console.error("Failed to execute git diff:", error);
      }
    };

    getGitDiff();
  }, [gitPath]);

  const { data, isLoading } = useAI(`${COMMIT_PROMPT}${gitDiff}\n\nGenerate:\n1. A "Commit Summary" line\n2. A "Commit Message" section with bullet points`, {
    creativity: 0,
    model: AI.Model.Anthropic_Claude_Sonnet,
    execute: Boolean(gitDiff),
  });

  useEffect(() => {
    if (data) {
      console.log("AI Response:", data);
    }
  }, [data]);

  return (
    <Detail
      isLoading={isLoading}
      markdown={
        data
          ? (() => {
              const { summary, messages } = parseCommitMessage(data);
              return `## Commit Summary
${summary}

## Commit Messages
${messages.join("\n")}`;
            })()
          : "Loading..."
      }
    />
  );
}