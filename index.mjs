var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// node_modules/jose/dist/node/esm/runtime/base64url.js
import { Buffer } from "node:buffer";

// node_modules/jose/dist/node/esm/lib/buffer_utils.js
var encoder = new TextEncoder;
var decoder = new TextDecoder;
var MAX_INT32 = 2 ** 32;

// node_modules/jose/dist/node/esm/runtime/base64url.js
function normalize(input) {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  return encoded;
}
var encode = (input) => Buffer.from(input).toString("base64url");
var decode = (input) => new Uint8Array(Buffer.from(normalize(input), "base64url"));

// node_modules/jose/dist/node/esm/util/base64url.js
var exports_base64url = {};
__export(exports_base64url, {
  encode: () => encode2,
  decode: () => decode2
});
var encode2 = encode;
var decode2 = decode;
// node_modules/@openauthjs/openauth/dist/esm/pkce.js
function generateVerifier(length) {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return exports_base64url.encode(buffer);
}
async function generateChallenge(verifier, method) {
  if (method === "plain")
    return verifier;
  const encoder2 = new TextEncoder;
  const data = encoder2.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return exports_base64url.encode(new Uint8Array(hash));
}
async function generatePKCE(length = 64) {
  if (length < 43 || length > 128) {
    throw new Error("Code verifier length must be between 43 and 128 characters");
  }
  const verifier = generateVerifier(length);
  const challenge = await generateChallenge(verifier, "S256");
  return {
    verifier,
    challenge,
    method: "S256"
  };
}

// src/constants.ts
var CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
var TOOL_PREFIX = "mcp_";
var REQUIRED_BETAS = [
  "oauth-2025-04-20",
  "interleaved-thinking-2025-05-14"
];

// src/auth.ts
async function authorize(mode) {
  const pkce = await generatePKCE();
  const url = new URL(`https://${mode === "console" ? "console.anthropic.com" : "claude.ai"}/oauth/authorize`, import.meta.url);
  url.searchParams.set("code", "true");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", "https://console.anthropic.com/oauth/code/callback");
  url.searchParams.set("scope", "org:create_api_key user:profile user:inference");
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", pkce.verifier);
  return {
    url: url.toString(),
    verifier: pkce.verifier
  };
}
async function exchange(code, verifier) {
  const splits = code.split("#");
  const result = await fetch("https://console.anthropic.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "claude-cli/2.1.2 (external, cli)"
    },
    body: new URLSearchParams({
      code: splits[0] ?? "",
      state: splits[1] ?? "",
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: "https://console.anthropic.com/oauth/code/callback",
      code_verifier: verifier
    }).toString()
  });
  if (!result.ok) {
    return {
      type: "failed"
    };
  }
  const json = await result.json();
  return {
    type: "success",
    refresh: json.refresh_token,
    access: json.access_token,
    expires: Date.now() + json.expires_in * 1000
  };
}

// src/transform.ts
function mergeHeaders(input, init) {
  const headers = new Headers;
  if (input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  const initHeaders = init?.headers;
  if (initHeaders) {
    if (initHeaders instanceof Headers) {
      initHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    } else if (Array.isArray(initHeaders)) {
      for (const entry of initHeaders) {
        const [key, value] = entry;
        if (typeof value !== "undefined") {
          headers.set(key, String(value));
        }
      }
    } else {
      for (const [key, value] of Object.entries(initHeaders)) {
        if (typeof value !== "undefined") {
          headers.set(key, String(value));
        }
      }
    }
  }
  return headers;
}
function mergeBetaHeaders(headers) {
  const incomingBeta = headers.get("anthropic-beta") || "";
  const incomingBetasList = incomingBeta.split(",").map((b) => b.trim()).filter(Boolean);
  return [...new Set([...REQUIRED_BETAS, ...incomingBetasList])].join(",");
}
function setOAuthHeaders(headers, accessToken) {
  headers.set("authorization", `Bearer ${accessToken}`);
  headers.set("anthropic-beta", mergeBetaHeaders(headers));
  headers.set("user-agent", "claude-cli/2.1.2 (external, cli)");
  headers.delete("x-api-key");
  return headers;
}
function prefixToolNames(body) {
  try {
    const parsed = JSON.parse(body);
    if (parsed.tools && Array.isArray(parsed.tools)) {
      parsed.tools = parsed.tools.map((tool) => ({
        ...tool,
        name: tool.name ? `${TOOL_PREFIX}${tool.name}` : tool.name
      }));
    }
    if (parsed.messages && Array.isArray(parsed.messages)) {
      parsed.messages = parsed.messages.map((msg) => {
        if (msg.content && Array.isArray(msg.content)) {
          msg.content = msg.content.map((block) => {
            if (block.type === "tool_use" && block.name) {
              return {
                ...block,
                name: `${TOOL_PREFIX}${block.name}`
              };
            }
            return block;
          });
        }
        return msg;
      });
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}
function stripToolPrefix(text) {
  return text.replace(/"name"\s*:\s*"mcp_([^"]+)"/g, '"name": "$1"');
}
function rewriteUrl(input) {
  let requestUrl = null;
  try {
    if (typeof input === "string" || input instanceof URL) {
      requestUrl = new URL(input.toString());
    } else if (input instanceof Request) {
      requestUrl = new URL(input.url);
    }
  } catch {
    requestUrl = null;
  }
  if (requestUrl && requestUrl.pathname === "/v1/messages" && !requestUrl.searchParams.has("beta")) {
    requestUrl.searchParams.set("beta", "true");
    const newInput = input instanceof Request ? new Request(requestUrl.toString(), input) : requestUrl;
    return { input: newInput, url: requestUrl };
  }
  return { input, url: requestUrl };
}
function createStrippedStream(response) {
  if (!response.body)
    return response;
  const reader = response.body.getReader();
  const decoder2 = new TextDecoder;
  const encoder2 = new TextEncoder;
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      let text = decoder2.decode(value, { stream: true });
      text = stripToolPrefix(text);
      controller.enqueue(encoder2.encode(text));
    }
  });
  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// src/index.ts
var AnthropicAuthPlugin = async ({ client }) => {
  return {
    "experimental.chat.system.transform": (input, output) => {
      const prefix = "You are Claude Code, Anthropic's official CLI for Claude.";
      if (input.model?.providerID === "anthropic") {
        output.system.unshift(prefix);
        if (output.system[1])
          output.system[1] = `${prefix}

${output.system[1]}`;
      }
    },
    auth: {
      provider: "anthropic",
      async loader(getAuth, provider) {
        const auth = await getAuth();
        if (auth.type === "oauth") {
          for (const model of Object.values(provider.models)) {
            model.cost = {
              input: 0,
              output: 0,
              cache: {
                read: 0,
                write: 0
              }
            };
          }
          return {
            apiKey: "",
            async fetch(input, init) {
              const auth2 = await getAuth();
              if (auth2.type !== "oauth")
                return fetch(input, init);
              if (!auth2.access || !auth2.expires || auth2.expires < Date.now()) {
                const maxRetries = 2;
                const baseDelayMs = 500;
                for (let attempt = 0;attempt <= maxRetries; attempt++) {
                  try {
                    if (attempt > 0) {
                      const delay = baseDelayMs * 2 ** (attempt - 1);
                      await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                    const response2 = await fetch("https://console.anthropic.com/v1/oauth/token", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "claude-cli/2.1.2 (external, cli)"
                      },
                      body: new URLSearchParams({
                        grant_type: "refresh_token",
                        refresh_token: auth2.refresh,
                        client_id: CLIENT_ID
                      }).toString()
                    });
                    if (!response2.ok) {
                      if (response2.status >= 500 && attempt < maxRetries) {
                        await response2.body?.cancel();
                        continue;
                      }
                      throw new Error(`Token refresh failed: ${response2.status}`);
                    }
                    const json = await response2.json();
                    await client.auth.set({
                      path: {
                        id: "anthropic"
                      },
                      body: {
                        type: "oauth",
                        refresh: json.refresh_token,
                        access: json.access_token,
                        expires: Date.now() + json.expires_in * 1000
                      }
                    });
                    auth2.access = json.access_token;
                    break;
                  } catch (error) {
                    const isNetworkError = error instanceof Error && (error.message.includes("fetch failed") || ("code" in error) && (error.code === "ECONNRESET" || error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "UND_ERR_CONNECT_TIMEOUT"));
                    if (attempt < maxRetries && isNetworkError) {
                      continue;
                    }
                    throw error;
                  }
                }
              }
              const requestHeaders = mergeHeaders(input, init);
              setOAuthHeaders(requestHeaders, auth2.access);
              let body = init?.body;
              if (body && typeof body === "string") {
                body = prefixToolNames(body);
              }
              const rewritten = rewriteUrl(input);
              const response = await fetch(rewritten.input, {
                ...init,
                body,
                headers: requestHeaders
              });
              return createStrippedStream(response);
            }
          };
        }
        return {};
      },
      methods: [
        {
          label: "Claude Pro/Max",
          type: "oauth",
          authorize: async () => {
            const { url, verifier } = await authorize("max");
            return {
              url,
              instructions: "Paste the authorization code here: ",
              method: "code",
              callback: async (code) => {
                const credentials = await exchange(code, verifier);
                return credentials;
              }
            };
          }
        },
        {
          label: "Create an API Key",
          type: "oauth",
          authorize: async () => {
            const { url, verifier } = await authorize("console");
            return {
              url,
              instructions: "Paste the authorization code here: ",
              method: "code",
              callback: async (code) => {
                const credentials = await exchange(code, verifier);
                if (credentials.type === "failed")
                  return credentials;
                const result = await fetch(`https://api.anthropic.com/api/oauth/claude_cli/create_api_key`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    authorization: `Bearer ${credentials.access}`
                  }
                }).then((r) => r.json());
                return { type: "success", key: result.raw_key };
              }
            };
          }
        },
        {
          provider: "anthropic",
          label: "Manually enter API Key",
          type: "api"
        }
      ]
    }
  };
};
export {
  AnthropicAuthPlugin
};
