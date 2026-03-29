/**
 * Brain Cabinet API クライアント
 *
 * Command APIを呼び出し、MCPツールのレスポンス形式に変換する。
 */

const API_BASE = process.env.BRAIN_CABINET_API_URL || "https://api.brain-cabinet.com";
const API_KEY = process.env.BRAIN_CABINET_API_KEY || "";

type McpToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export const callBrainCabinet = async (
  action: string,
  payload: Record<string, unknown>,
): Promise<McpToolResult> => {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_KEY) {
      headers["x-api-key"] = API_KEY;
    }

    const res = await fetch(`${API_BASE}/api/v1`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, payload }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        content: [{ type: "text", text: `API error ${res.status}: ${text}` }],
        isError: true,
      };
    }

    const data = await res.json();

    if (!data.success) {
      return {
        content: [
          {
            type: "text",
            text: `Command failed: ${data.error?.message || "Unknown error"} (code: ${data.error?.code || "UNKNOWN"})`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data.result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
};
