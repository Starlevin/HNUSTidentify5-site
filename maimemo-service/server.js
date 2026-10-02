import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const BASE_URL = "https://open.maimemo.com/open/api/v1";
const PORT = Number(process.env.PORT || 10000);
const MCP_SECRET = (process.env.MCP_PATH_SECRET || "").trim();

function token() {
  const value = (process.env.MAIMEMO_TOKEN || "").trim();
  if (!value) throw new Error("MAIMEMO_TOKEN is not configured");
  return value;
}

async function post(path, payload = {}) {
  const response = await fetch(BASE_URL + path, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token(),
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }

  if (!response.ok) {
    throw new Error("MaiMemo HTTP " + response.status + ": " + (body?.message || body?.error || raw || response.statusText));
  }
  if (body && body.success === false) {
    throw new Error("MaiMemo API error: " + JSON.stringify(body).slice(0, 500));
  }
  return body?.data ?? body;
}

function textResult(data, note) {
  return {
    content: [{ type: "text", text: note }],
    structuredContent: data
  };
}

function errorResult(err) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent: { error: message }
  };
}

function registerTools(server) {
  server.registerTool(
    "get_today_progress",
    {
      title: "墨墨今日学习进度",
      description: "查询今天的完成数量、总任务和学习时长。",
      inputSchema: {}
    },
    async () => {
      try {
        const data = await post("/memo/study/get_study_progress", {});
        const p = data?.progress || {};
        return textResult({
          progress: p,
          remaining: Number.isFinite(p.total) && Number.isFinite(p.finished)
            ? Math.max(0, p.total - p.finished)
            : null,
          study_minutes: Number.isFinite(p.study_time)
            ? Math.round(p.study_time / 6000) / 10
            : null
        }, "已读取今天的墨墨学习进度。");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_today_words",
    {
      title: "墨墨今日学习单词",
      description: "查询今天学习队列中的单词，可筛选已完成、新词或复习词，并返回首次反馈。",
      inputSchema: {
        is_finished: z.boolean().optional(),
        is_new: z.boolean().optional(),
        limit: z.number().int().min(1).max(1000).default(1000)
      }
    },
    async ({ is_finished, is_new, limit }) => {
      try {
        const payload = { limit };
        if (typeof is_finished === "boolean") payload.is_finished = is_finished;
        if (typeof is_new === "boolean") payload.is_new = is_new;

        const data = await post("/memo/study/get_today_items", payload);
        const items = data?.today_items || [];
        return textResult({
          today_items: items,
          summary: {
            count: items.length,
            finished: items.filter(x => x.is_finished).length,
            new: items.filter(x => x.is_new).length,
            review: items.filter(x => !x.is_new).length,
            forget: items.filter(x => x.first_response === "FORGET").length,
            vague: items.filter(x => x.first_response === "VAGUE").length,
            familiar: items.filter(x => x.first_response === "FAMILIAR").length,
            well_familiar: items.filter(x => x.first_response === "WELL_FAMILIAR").length
          }
        }, "已读取今天的墨墨单词。");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "lookup_word_history",
    {
      title: "查询墨墨单词学习记录",
      description: "按拼写查询单词当前学习记录，包括首次学习、最近学习、下次复习、学习次数和最近反馈。",
      inputSchema: {
        spellings: z.array(z.string().min(1)).min(1).max(1000)
      }
    },
    async ({ spellings }) => {
      try {
        const data = await post("/memo/study/query_study_records", {
          spellings,
          limit: Math.min(1000, Math.max(50, spellings.length * 3))
        });
        return textResult(data, "已查询指定单词的墨墨学习记录。");
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "query_study_records",
    {
      title: "查询墨墨学习记录",
      description: "查询当前学习记录。可按 next_study_date 筛选；last_study_date 仅代表最近一次学习日，不能完整还原历史每日流水。",
      inputSchema: {
        start: z.string().optional(),
        end: z.string().optional(),
        as_count: z.boolean().default(false),
        limit: z.number().int().min(1).max(1000).default(1000)
      }
    },
    async ({ start, end, as_count, limit }) => {
      try {
        const payload = { as_count, limit };
        if (start || end) {
          payload.next_study_date = {};
          if (start) payload.next_study_date.start = start;
          if (end) payload.next_study_date.end = end;
        }
        const data = await post("/memo/study/query_study_records", payload);
        return textResult(data, "已读取墨墨学习记录。");
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

function makeServer() {
  const server = new McpServer(
    { name: "maimemo-study", version: "1.0.0" },
    {
      instructions:
        "这是用户自己的墨墨背单词只读工具。今天的数据优先调用 get_today_progress 和 get_today_words；特定单词用 lookup_word_history。不要把 last_study_date 误称为完整历史学习流水。"
    }
  );
  registerTools(server);
  return server;
}

function mcpPath() {
  if (!MCP_SECRET) return "/mcp-disabled";
  return "/mcp/" + MCP_SECRET;
}

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: true,
      token_configured: Boolean((process.env.MAIMEMO_TOKEN || "").trim()),
      mcp_secret_configured: Boolean(MCP_SECRET)
    }));
    return;
  }

  if (url.pathname === mcpPath() && req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id, accept",
      "Access-Control-Expose-Headers": "Mcp-Session-Id"
    });
    res.end();
    return;
  }

  if (url.pathname === mcpPath() && ["POST", "GET", "DELETE"].includes(req.method || "")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("MaiMemo MCP server listening on port " + PORT);
});
