/** sha256 via WebCrypto (available in browsers, workers and Node >= 20). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', view as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** sha256 of the newline-joined names: the definition used for parameter/state order hashes. */
export async function orderSha256(names: string[]): Promise<string> {
  return sha256Hex(new TextEncoder().encode(names.join('\n')))
}
