import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const schema = z.object({ tracks: z.array(z.object({ title: z.string() })) });

function groqResponse(content: string, ok = true): Response {
  return {
    ok,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

async function loadModules() {
  const client = await import("@/lib/groq/client");
  const errors = await import("@/lib/errors");
  return { ...client, ...errors };
}

const messages = [{ role: "user" as const, content: "make a session" }];

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  process.env.GROQ_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GROQ_API_KEY;
});

describe("groqJson (structured LLM output)", () => {
  it("returns validated data on the first attempt", async () => {
    const { groqJson } = await loadModules();
    fetchMock.mockResolvedValueOnce(
      groqResponse('{"tracks":[{"title":"Intro"}]}'),
    );

    const result = await groqJson(schema, messages);
    expect(result.tracks[0].title).toBe("Intro");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when the response is not valid JSON, feeding back the error", async () => {
    const { groqJson } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(groqResponse("Sure! Here is your playlist: ..."))
      .mockResolvedValueOnce(groqResponse('{"tracks":[{"title":"Intro"}]}'));

    const result = await groqJson(schema, messages);
    expect(result.tracks[0].title).toBe("Intro");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(retryBody.messages.at(-1).content).toMatch(/not valid JSON/);
  });

  it("retries once when JSON is valid but fails schema validation", async () => {
    const { groqJson } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(groqResponse('{"wrong_key": true}'))
      .mockResolvedValueOnce(groqResponse('{"tracks":[{"title":"Intro"}]}'));

    const result = await groqJson(schema, messages);
    expect(result.tracks[0].title).toBe("Intro");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a friendly error after two unreadable attempts (never free-form text)", async () => {
    const { groqJson, FRIENDLY } = await loadModules();
    fetchMock
      .mockResolvedValueOnce(groqResponse("not json"))
      .mockResolvedValueOnce(groqResponse("still not json"));

    await expect(groqJson(schema, messages)).rejects.toThrow(FRIENDLY.groqUnreadable);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a 503 ApiError without calling the network when unconfigured", async () => {
    delete process.env.GROQ_API_KEY;
    const { groqJson, ApiError } = await loadModules();

    await expect(groqJson(schema, messages)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps HTTP failures (e.g. rate limit) to a friendly error", async () => {
    const { groqJson, FRIENDLY } = await loadModules();
    fetchMock.mockResolvedValueOnce(groqResponse("", false));

    await expect(groqJson(schema, messages)).rejects.toThrow(FRIENDLY.groqDown);
  });

  it("maps network failures/timeouts to a friendly error", async () => {
    const { groqJson, FRIENDLY } = await loadModules();
    fetchMock.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));

    await expect(groqJson(schema, messages)).rejects.toThrow(FRIENDLY.groqDown);
  });

  it("treats a response with no content as unreadable", async () => {
    const { groqJson, FRIENDLY } = await loadModules();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response);

    await expect(groqJson(schema, messages)).rejects.toThrow(FRIENDLY.groqUnreadable);
  });
});
