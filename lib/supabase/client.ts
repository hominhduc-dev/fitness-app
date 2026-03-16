"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getSupabasePublicConfig } from "./config"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient
  }

  const { publishableKey, url } = getSupabasePublicConfig()

  browserClient = createBrowserClient(url, publishableKey)
  return browserClient
}
