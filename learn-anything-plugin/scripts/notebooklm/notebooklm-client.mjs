import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const DEFAULT_ENDPOINT = process.env.NOTEBOOKLM_MCP_ENDPOINT || 'http://localhost:18000/mcp';

export const DEFAULT_CHAT_PROMPT = `You are used as a concise source-grounded research assistant for a learning workflow.

Use only the provided notebook sources. Do not invent facts, citations, timestamps, or links. If the sources do not support an answer, say so explicitly.

Keep answers short and structured. Use bullet points by default. Use tables only when they clarify comparison. Return compact JSON only when explicitly requested. Keep evidence quotes brief; quote only the minimum needed to support the answer.

For YouTube video work:
- A video source title contains the video id in square brackets: <video title> [<video-id>]
- A matching subtitle transcript source contains the same [<video-id>] and may be named <video title> [<video-id>].srt.txt
- A matching chapters source contains the same [<video-id>] and may be named <video title> [<video-id>].chapters.txt
- Prefer subtitle transcript sources for precise timestamp evidence.
- Use chapters sources to understand video structure, section boundaries, and topic navigation.
- When both subtitles and chapters are available, use chapters to identify the relevant section and subtitles to find exact timestamp evidence.
- Extract the video id from square brackets.
- Extract timestamps from subtitle cues when available.
- Convert timestamps to seconds.
- Build direct links as:
  https://www.youtube.com/watch?v=<video-id>&t=<seconds>s

Rules:
- Do not invent timestamps.
- Do not return timestamp links without source evidence.
- If timestamped evidence is unavailable, say so explicitly.
- If asked for JSON, return valid JSON only, with no Markdown fences.`;

export function parseSseOrJson(data) {
  const dataLines = data.split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6).trim())
    .filter(Boolean);
  if (dataLines.length > 0) return JSON.parse(dataLines[dataLines.length - 1]);
  return JSON.parse(data);
}

export function mcpCall(endpoint, toolName, args = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    });
    const url = new URL(endpoint);
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(parseSseOrJson(data));
        } catch (err) {
          reject(new Error(`MCP response parse failed: ${err.message}; prefix=${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`MCP request timeout calling ${toolName}`));
    });
    req.write(body);
    req.end();
  });
}

export function parseToolPayload(result, toolName) {
  if (result.error) throw new Error(`MCP error from ${toolName}: ${result.error.message || JSON.stringify(result.error)}`);
  const toolResult = result.result;
  if (!toolResult) throw new Error(`Missing MCP tool result from ${toolName}`);
  if (toolResult.isError) {
    const text = toolResult.content?.[0]?.text || JSON.stringify(toolResult);
    throw new Error(`${toolName} failed: ${text}`);
  }
  let payload = toolResult.structuredContent;
  if (!payload) {
    const text = toolResult.content?.find((item) => item?.type === 'text')?.text;
    if (!text) throw new Error(`${toolName} returned no text payload`);
    try { payload = JSON.parse(text); } catch { payload = { status: 'success', text }; }
  }
  if (payload.status === 'error') throw new Error(`${toolName}: ${payload.error || payload.message || 'unknown error'}`);
  return payload;
}

export async function callTool(endpoint, toolName, args = {}, timeoutMs = 30000) {
  return parseToolPayload(await mcpCall(endpoint, toolName, args, timeoutMs), toolName);
}

export async function callFirstTool(endpoint, candidates, args, timeoutMs = 30000) {
  const errors = [];
  for (const toolName of candidates) {
    try {
      const payload = await callTool(endpoint, toolName, args, timeoutMs);
      return { toolName, payload };
    } catch (err) {
      errors.push(`${toolName}: ${err.message}`);
    }
  }
  throw new Error(`all candidate tools failed:\n${errors.join('\n')}`);
}

export function pickId(payload) {
  return payload.source_id || payload.id || payload.sourceId || payload?.source?.id || payload?.source?.source_id || null;
}

export function pickTitle(payload) {
  return payload.title || payload.source_title || payload?.source?.title || payload.name || payload?.source?.name || null;
}

export function extractYouTubeVideoId(input) {
  const value = String(input || '').trim();
  const patterns = [
    /(?:youtube\.com\/watch\?[^\s#]*v=)([A-Za-z0-9_-]{6,})/i,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
    /(?:youtube\.com\/(?:embed|shorts)\/)([A-Za-z0-9_-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  if (/^[A-Za-z0-9_-]{6,}$/.test(value)) return value;
  return null;
}

export function isYouTubeUrl(url) {
  return Boolean(extractYouTubeVideoId(url));
}

export function canonicalYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
