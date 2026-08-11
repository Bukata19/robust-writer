// Shared client-side AI failure logging.
//
// Supabase's `functions.invoke` surfaces non-2xx responses as a
// FunctionsHttpError whose `.context` is the raw Response — the actual status
// and error body live there, not in `error.message` ("Edge Function returned a
// non-2xx status code"). This reads both out and logs them so a failure can be
// diagnosed from a browser-console screenshot alone.
export async function logAiFailure(source: string, err: unknown): Promise<void> {
  const anyErr = err as any;
  let status: number | undefined;
  let body: string | undefined;
  try {
    const res: Response | undefined = anyErr?.context;
    if (res && typeof res.status === 'number') {
      status = res.status;
      body = await res.clone().text();
    }
  } catch {
    /* body already consumed or unavailable */
  }
  console.error(
    `[AI:${source}] request failed`,
    { status: status ?? anyErr?.status ?? 'unknown', message: anyErr?.message, body: body?.slice(0, 2000) },
  );
}
