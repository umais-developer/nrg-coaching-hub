// Note file format and the client half of server-side encryption.
//
// The encryption key lives ONLY in Val Town env. This module never sees it —
// it sends plaintext/ciphertext plus the caller's GitHub token to the val,
// which verifies ownership and does the crypto. That is the whole point: a key
// shipped to this bundle would be public, since the bundle is served from
// GitHub Pages and window.APP_CONFIG is writable from the console.
//
// Encrypted note on disk:
//
//   Coach: umais-developer          <- readable
//   Member: Aaron Medina            <- readable
//   Visibility: shared              <- readable, gates member access
//   Meeting Date: 2026-08-12        <- readable
//   Encryption: v1                  <- absent means legacy plaintext
//                                   <- blank line, structural separator
//   Discussion Notes:
//   <base64 ciphertext>
//
// Headers stay readable so roles.js can filter without decrypting, and so a
// note remains identifiable if the key is ever lost. What it costs: member
// names, teams, and dates are public. Paths and commit messages leak the same
// facts anyway, so encrypting headers would buy little.

import { APP_CONFIG } from "../config";
import { getToken } from "./githubAuth";

export const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_HEADER = "Encryption";
const BODY_LABEL = "Discussion Notes:";

// Off unless explicitly enabled. Decryption of already-encrypted notes is
// driven by the note's own Encryption header, not by this flag, so turning the
// flag back off never makes existing notes unreadable.
export function isEncryptionEnabled() {
  return APP_CONFIG.NOTE_ENCRYPTION === true;
}

// Splits a note into its header block and everything after the blank line.
// The blank-line separator is load-bearing — roles.js:isNoteShared relies on it.
export function splitNote(noteText) {
  const text = String(noteText || "");
  const idx = text.search(/\r?\n\r?\n/);
  if (idx === -1) return { head: text, rest: "" };
  const sepLen = text.slice(idx).startsWith("\r\n\r\n") ? 4 : 2;
  return { head: text.slice(0, idx), rest: text.slice(idx + sepLen) };
}

export function parseNoteHeaders(noteText) {
  const { head } = splitNote(noteText);
  const headers = {};
  head.split(/\r?\n/).forEach((line) => {
    const m = /^([A-Za-z ]+):\s*(.*)$/.exec(line);
    if (m) headers[m[1].trim()] = m[2].trim();
  });
  return headers;
}

// Notes written before encryption existed have no Encryption header and are
// rendered as-is. This is what makes migration unnecessary.
export function isEncryptedNote(noteText) {
  return parseNoteHeaders(noteText)[ENCRYPTION_HEADER] === ENCRYPTION_VERSION;
}

// Strips the "Discussion Notes:" label to get at the payload
export function extractBody(noteText) {
  const { rest } = splitNote(noteText);
  const trimmed = rest.replace(/^\s*Discussion Notes:\s*\r?\n?/i, "");
  return trimmed.trim();
}

export function buildNoteText({ headers, body, encrypted }) {
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  if (encrypted) lines.push(`${ENCRYPTION_HEADER}: ${ENCRYPTION_VERSION}`);
  return [...lines, "", BODY_LABEL, body].join("\n");
}

function endpoint(route) {
  const base = String(APP_CONFIG.TOKEN_EXCHANGE_URL || "").replace(/\/+$/, "");
  return `${base}/${route}`;
}

async function callVal(route, payload) {
  const token = getToken();
  if (!token) throw new Error("Not signed in.");
  let res;
  try {
    res = await fetch(endpoint(route), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, token }),
    });
  } catch {
    throw new Error(
      "Could not reach the encryption service. Check your connection and try again."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Encryption service returned HTTP ${res.status}.`);
  }
  return data;
}

export async function encryptNoteBody({ path, plaintext }) {
  const { ciphertext } = await callVal("encrypt", { path, plaintext });
  if (!ciphertext) throw new Error("Encryption service returned no ciphertext.");
  return ciphertext;
}

export async function decryptNoteBody({ path, ciphertext }) {
  const { plaintext } = await callVal("decrypt", { path, ciphertext });
  return plaintext ?? "";
}

// Renders a note for display: decrypts when needed, passes legacy notes
// through untouched. Never returns raw ciphertext — a failure says so plainly.
export async function readableNote({ path, noteText }) {
  if (!isEncryptedNote(noteText)) return noteText;
  const { head } = splitNote(noteText);
  try {
    const plaintext = await decryptNoteBody({ path, ciphertext: extractBody(noteText) });
    return `${head}\n\n${BODY_LABEL}\n${plaintext}`;
  } catch (e) {
    return `${head}\n\n${BODY_LABEL}\n[Unable to decrypt this note: ${e.message}]`;
  }
}
