// Read-only project inventory for engram-web: one `engram mcp --tools=mem_list_projects`
// stdio cycle, parsed into the payload of `GET /local/projects`.
//
// Why MCP and not the HTTP API: the runtime exposes no project-management endpoints;
// `GET /stats?all_projects=true` answers bare names without counts and omits every project
// without observations — exactly the set pruning has to clean — and every endpoint that takes a
// project rejects path-like project names with 400 `invalid_project`
// (engram v2.0.0, facts 1-3 in odd/tasks/engram-web-projects.md).
//
// Safety: the child gets a fixed argv and a fixed stdio handshake, and is always killed. No
// data from the HTTP request reaches the process: not as an argument, not on stdin, not by
// environment. Configuration is limited to ENGRAM_BIN and ENGRAM_MCP_TIMEOUT_MS.
import { spawn } from 'node:child_process'

const DEFAULT_BIN = 'engram'
const DEFAULT_TIMEOUT_MS = 10000
const TOOL_NAME = 'mem_list_projects'

/** Inventory failure with the HTTP status `createProjectsHandler` must answer. */
export class InventoryError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'InventoryError'
    this.status = status
  }
}

function truncate(value, limit = 200) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text && text.length > limit ? `${text.slice(0, limit)}…` : String(text)
}

/**
 * Parses the newline-delimited JSON-RPC stdout of `engram mcp` into its messages.
 * Throws `InventoryError` when a line is not JSON or when nothing was written at all.
 */
export function parseStdout(output) {
  const messages = []
  for (const line of String(output ?? '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      messages.push(JSON.parse(trimmed))
    } catch {
      throw new InventoryError(`engram mcp wrote a stdout line that is not JSON: ${truncate(trimmed)}`)
    }
  }
  if (messages.length === 0) throw new InventoryError('engram mcp produced no output')
  return messages
}

/** Picks the response with the given JSON-RPC id, rejecting protocol-level errors. */
export function selectResult(messages, id = 2) {
  const message = messages.find((entry) => entry && typeof entry === 'object' && entry.id === id)
  if (!message) throw new InventoryError(`engram mcp did not answer the ${TOOL_NAME} call (no response for id ${id})`)
  if (message.error) {
    throw new InventoryError(`engram mcp rejected the ${TOOL_NAME} call: ${truncate(message.error.message ?? message.error)}`)
  }
  if (!message.result) throw new InventoryError(`engram mcp answered id ${id} without a result`)
  return message.result
}

/** The tool's own human-readable text, when it sent one. */
export function toolText(result) {
  const first = result && typeof result === 'object' ? result.content?.[0] : undefined
  return first && typeof first.text === 'string' ? first.text : ''
}

/**
 * Turns a `tools/call` result into `{ projects, count }`. Throws `InventoryError` on a tool
 * error, on text that is not JSON, and on a JSON payload without a `projects` array.
 */
export function extractProjects(result) {
  if (!result || typeof result !== 'object') throw new InventoryError('engram mcp returned an empty result')
  if (result.isError) {
    throw new InventoryError(`${TOOL_NAME} failed: ${toolText(result) || 'no detail provided by the tool'}`)
  }
  const text = toolText(result)
  if (!text) throw new InventoryError(`${TOOL_NAME} returned no text content`)

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new InventoryError(`${TOOL_NAME} returned text that is not JSON: ${truncate(text)}`)
  }
  return validateInventory(payload)
}

/** Validates the tool payload: `projects` must be an array and `count` a number. */
export function validateInventory(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.projects)) {
    throw new InventoryError(`${TOOL_NAME} returned a payload without a "projects" array: ${truncate(payload)}`)
  }
  if (typeof payload.count !== 'number') {
    throw new InventoryError(`${TOOL_NAME} returned a non-numeric count: ${truncate(payload.count)}`)
  }
  return { projects: payload.projects, count: payload.count }
}

/**
 * Runs the stdio cycle and resolves with `{ projects, count, binary }`. Every failure mode
 * (binary missing, timeout, tool error, unparsable output) becomes an `InventoryError`; an
 * empty inventory can only ever mean an empty store.
 */
export async function listProjects({ bin, timeoutMs } = {}) {
  const binary = bin ?? process.env.ENGRAM_BIN ?? DEFAULT_BIN
  const requested = Number(timeoutMs ?? process.env.ENGRAM_MCP_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  const limit = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_TIMEOUT_MS

  const child = spawn(binary, ['mcp', `--tools=${TOOL_NAME}`], { stdio: ['pipe', 'pipe', 'pipe'] })

  let stderr = ''
  const lines = []
  let stdoutBuffer = ''

  try {
    const inventory = await new Promise((resolve, reject) => {
      let settled = false
      let timer
      const finish = (error, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) reject(error)
        else resolve(value)
      }

      timer = setTimeout(() => {
        finish(
          new InventoryError(
            `engram mcp timed out after ${limit} ms; raise ENGRAM_MCP_TIMEOUT_MS if the store is large`,
            504,
          ),
        )
      }, limit)

      child.on('error', (error) => {
        if (error.code === 'ENOENT') {
          finish(
            new InventoryError(
              `engram binary not found ("${binary}"). Install Engram or point ENGRAM_BIN at it.`,
            ),
          )
          return
        }
        finish(new InventoryError(`could not start "${binary} mcp": ${error.message}`))
      })

      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })

      // A dead child makes the stdin write fail; the exit/error path owns that failure.
      child.stdin.on('error', () => {})

      child.stdout.on('data', (chunk) => {
        // A message can be split anywhere across chunks, so only newline-terminated pieces
        // are complete; the tail stays buffered until its line ends.
        stdoutBuffer += chunk
        const parts = stdoutBuffer.split('\n')
        stdoutBuffer = parts.pop() ?? ''
        for (const part of parts) if (part.trim()) lines.push(part.trim())
        // Last line of the exchange: accept it even if the newline never arrives.
        const tail = stdoutBuffer.trim()
        if (tail) {
          try {
            JSON.parse(tail)
            lines.push(tail)
            stdoutBuffer = ''
          } catch {
            // Still a partial line: keep buffering.
          }
        }
        if (lines.length === 0) return

        let messages
        try {
          messages = parseStdout(lines.join('\n'))
        } catch (error) {
          finish(error)
          return
        }
        if (!messages.some((message) => message && message.id === 2)) return

        try {
          finish(undefined, extractProjects(selectResult(messages, 2)))
        } catch (error) {
          finish(error)
        }
      })

      child.on('close', (code) => {
        finish(
          new InventoryError(
            `engram mcp exited before answering the ${TOOL_NAME} call (code ${code})` +
              (stderr.trim() ? `: ${stderr.trim()}` : ''),
          ),
        )
      })

      const handshake = [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'engram-web', version: '0.1.0' },
          },
        },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: TOOL_NAME, arguments: {} } },
      ]
      child.stdin.write(`${handshake.map((message) => JSON.stringify(message)).join('\n')}\n`)
    })

    return { ...inventory, binary }
  } finally {
    // The MCP server keeps serving after the answer, so no child may outlive the request.
    child.kill()
  }
}

/**
 * The `GET /local/projects` handler, shared by server/server.mjs (production) and the Vite
 * dev plugin. `/local/*` is deliberately distinct from `/api/*`, which stays a pure rewrite
 * to the runtime.
 */
export function createProjectsHandler() {
  return async function projectsHandler(req, res) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: `method ${req.method} is not allowed on /local/projects` })
      return
    }
    try {
      sendJson(res, 200, await listProjects())
    } catch (error) {
      if (error instanceof InventoryError) {
        sendJson(res, error.status, { error: error.message })
        return
      }
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}
