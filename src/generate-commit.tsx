// import { Detail } from "@raycast/api";
// import { useAI } from "@raycast/utils";

// export default function Command() {
//   const { data, isLoading } = useAI("Suggest 5 jazz songs");

//   return <Detail isLoading={isLoading} markdown={data} />;
// }
import { ActionPanel, Detail, Form, Action, useNavigation, AI } from "@raycast/api";
import { useAI } from "@raycast/utils";
import { useEffect, useState } from "react";
import { exec } from "child_process";

export default function Command() {
  const { push } = useNavigation();
  const [gitPath, setGitPath] = useState<string>("");

  function handleSubmit() {
    push(<GenerateCommitMessage gitPath={gitPath} />);
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Generate Commit Message" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="gitPath"
        title="Git Repository Path"
        placeholder="Enter the path to your Git repository"
        value={gitPath}
        onChange={setGitPath}
      />
    </Form>
  );
}

function GenerateCommitMessage({ gitPath }: { gitPath: string }) {
  const [gitDiff, setGitDiff] = useState<string>("");

  useEffect(() => {
    exec(`git -C "${gitPath}" diff`, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      setGitDiff(stdout);
    });
  }, [gitPath]);

  const prompt = `
You are a Git commit message generator. Given the git diff content below, generate a concise and descriptive commit message following these rules:

1. Summary line (50 chars or less):
-   Start with a capital letter
-   Use imperative mood ("Add", "Fix", "Update", not "Added", "Fixed", "Updated")
-   No period at the end
-   Be specific and meaningful

2. Detailed description (72 chars per line):
-   Leave one blank line after summary
-   Explain what and why vs. how
-   List major changes with bullet points
-   Include relevant issue/ticket numbers
-   Explain breaking changes if any

Git diff content:
${gitDiff}

Generate:
1. A "Commit Summary" line
2. A "Commit Message" section with bullet points
`;

  const { data, isLoading } = useAI(prompt, {
    creativity: 0.3,
    model: AI.Model.Anthropic_Claude_Sonnet, // Ensure this model is available
    execute: !!gitDiff,
  });

  return (
    <Detail
      isLoading={isLoading}
      markdown={
        data
          ? (() => {
            // 提取 Commit Summary
            const summaryMatch = data.match(/Commit Summary:\s*([\s\S]*?)(?=\s*Commit Message:)/);
            const summary = summaryMatch ? summaryMatch[1].trim() : '';

            // 提取 Commit Messages
            const messageMatch = data.match(/Commit Message:\s*([\s\S]*$)/);
            const messages = messageMatch
              ? messageMatch[1]
                .trim()
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('-'))
                .join('\n')
              : '';

            return `## Commit Summary
  ${summary}
  
  ## Commit Messages
  ${messages}`;
          })()
          : "Loading..."
      }
    />
  );


}