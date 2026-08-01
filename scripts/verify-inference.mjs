#!/usr/bin/env node
/**
 * Verifies the one assumption the test suite cannot cover: that Workers AI
 * accepts our multimodal payload shape (OpenAI-style `image_url` content
 * parts) for the configured vision model, and returns parseable JSON.
 *
 * Runs against the Workers AI REST API, so it needs no deploy — use it before
 * shipping the Workers, and again if you change WORKERS_AI_MODEL.
 *
 * Usage:
 *   export CLOUDFLARE_ACCOUNT_ID=...
 *   export CLOUDFLARE_API_TOKEN=...     # needs the "Workers AI: Read" permission
 *   node scripts/verify-inference.mjs
 *
 * Costs a few Neurons against the free daily allocation.
 */

import { deflateSync } from "node:zlib";

const MODEL =
  process.env.WORKERS_AI_MODEL ?? "@cf/mistralai/mistral-small-3.1-24b-instruct";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DRY_RUN = process.argv.includes("--dry-run");

if (!DRY_RUN && (!ACCOUNT || !TOKEN)) {
  console.error(
    "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first.\n" +
      "Account ID: Cloudflare dashboard > Workers & Pages > right sidebar.\n" +
      "Token: My Profile > API Tokens > Create Token > Workers AI (Read).",
  );
  process.exit(2);
}

// --- minimal PNG encoder, so the test image needs no fixture file ---

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Solid-colour RGB PNG. */
function makePng(width, height, [r, g, b]) {
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const offset = y * stride;
    raw[offset] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 3] = r;
      raw[offset + 2 + x * 3] = g;
      raw[offset + 3 + x * 3] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A saturated navy square — unambiguous enough that a correct answer proves
// the model actually saw the image rather than guessing from the prompt.
const NAVY = [31, 48, 94];
const png = makePng(96, 96, NAVY);
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

const body = {
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: 'Look at this image. Reply with ONLY JSON: {"hex":"#rrggbb","name":"colour name"} describing the single colour filling it.',
        },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ],
  max_tokens: 200,
  temperature: 0,
};

console.log(`Model:      ${MODEL}`);
console.log(`Test image: 96x96 solid rgb(${NAVY.join(",")}) — expect navy/dark blue`);
console.log(`Payload:    OpenAI-style content parts with image_url\n`);

if (DRY_RUN) {
  // Self-check the generated fixture without spending quota, so a failure
  // here is unambiguously the encoder and not the model.
  const sig = png.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const ihdr = png.subarray(12, 16).toString("ascii") === "IHDR";
  const iend = png.subarray(-8, -4).toString("ascii") === "IEND";
  const ok = sig && ihdr && iend;
  console.log(`PNG signature:   ${sig ? "ok" : "BAD"}`);
  console.log(`IHDR / IEND:     ${ihdr && iend ? "ok" : "BAD"}`);
  console.log(`Dimensions:      ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  console.log(`Encoded size:    ${png.length} bytes (${dataUrl.length} chars as data URL)`);
  console.log(`\nRequest body that would be sent:`);
  console.log(
    JSON.stringify(body, null, 2).replace(
      /"url": "data:image\/png;base64,[^"]+"/,
      '"url": "data:image/png;base64,<…>"',
    ),
  );
  console.log(`\n${ok ? "Dry run OK" : "Dry run FAILED"} — no API call made.`);
  process.exit(ok ? 0 : 1);
}

const response = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${MODEL}`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  },
);

const text = await response.text();

if (!response.ok) {
  console.error(`FAIL  HTTP ${response.status}`);
  console.error(text.slice(0, 1200));
  console.error(
    "\nIf the error mentions the message/content format, the multimodal payload\n" +
      "shape is what needs changing — see buildVisionMessages in\n" +
      "workers/mistral-proxy/src/index.ts.",
  );
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(text);
} catch {
  console.error("FAIL  Response was not JSON:\n" + text.slice(0, 800));
  process.exit(1);
}

const result = payload.result?.response ?? payload.result;
console.log("Raw model output:");
console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));

const asText = typeof result === "string" ? result : JSON.stringify(result);
const sawBlue = /navy|blue|#1[0-9a-f]|#2[0-9a-f]/i.test(asText);

console.log(
  `\nPayload shape accepted: yes` +
    `\nModel identified a blue/navy colour: ${sawBlue ? "yes" : "NO — check the image actually reached it"}`,
);
process.exit(sawBlue ? 0 : 1);
