import { expect, test } from "@playwright/test";

test("answers a question and shows citations", async ({ page }) => {
  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            title: "Refund FAQ.md",
            type: "markdown",
            fileName: "Refund FAQ.md",
            fileType: "text/markdown",
            status: "ready",
            chunkCount: 3,
            metadata: {},
            createdAt: "2026-06-29T00:00:00Z",
            updatedAt: "2026-06-29T00:00:00Z",
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [], messages: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "22222222-2222-2222-2222-222222222222",
        userMessage: {
          id: "33333333-3333-3333-3333-333333333333",
          sessionId: "22222222-2222-2222-2222-222222222222",
          role: "user",
          content: "Do refunds work?",
          sources: [],
          createdAt: "2026-06-29T00:00:01Z",
        },
        assistantMessage: {
          id: "44444444-4444-4444-4444-444444444444",
          sessionId: "22222222-2222-2222-2222-222222222222",
          role: "assistant",
          content: "Refunds are available within 7 days.",
          sources: [
            {
              chunkId: "55555555-5555-5555-5555-555555555555",
              itemId: "11111111-1111-1111-1111-111111111111",
              itemTitle: "Refund FAQ.md",
              chunkIndex: 0,
              content: "The product supports refunds within 7 days.",
              summary: "The product supports refunds within 7 days.",
              similarity: 0.92,
            },
          ],
          createdAt: "2026-06-29T00:00:02Z",
        },
      }),
    });
  });

  await page.route(/\/api\/feedback$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("link", { name: "资料库" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "资料库" })).toBeHidden();
  await page.getByTestId("universal-composer-input").fill("Do refunds work?");
  await page.getByTestId("send-question-button").click();

  await expect(
    page.getByText("Refunds are available within 7 days.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("来源：")).toBeVisible();
  await expect(page.getByText("Refund FAQ.md #1")).toBeVisible();

  await page.getByText("Refund FAQ.md #1").click();
  await expect(
    page.getByText("The product supports refunds within 7 days."),
  ).toBeVisible();

  await page.getByLabel("显示来源").uncheck();

  await expect(page.getByText("来源：")).toBeHidden();
});

test("starts on a new conversation and can reopen history", async ({ page }) => {
  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.searchParams.get("sessionId")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "66666666-6666-6666-6666-666666666666",
              sessionId: "55555555-5555-5555-5555-555555555555",
              role: "user",
              content: "History question",
              sources: [],
              createdAt: "2026-06-29T00:00:01Z",
            },
            {
              id: "77777777-7777-7777-7777-777777777777",
              sessionId: "55555555-5555-5555-5555-555555555555",
              role: "assistant",
              content: "History answer",
              sources: [],
              createdAt: "2026-06-29T00:00:02Z",
            },
          ],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessions: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            title: "History question",
            messageCount: 2,
            createdAt: "2026-06-29T00:00:00Z",
            updatedAt: "2026-06-29T00:00:02Z",
          },
        ],
        messages: [],
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("History question")).toBeVisible();
  await expect(page.getByText("History answer")).toBeHidden();

  await page.getByRole("button", { name: "打开 History question" }).click();

  await expect(page.getByText("History answer")).toBeVisible();
});

test("renames and deletes a history conversation from the sidebar", async ({ page }) => {
  const sessionId = "55555555-5555-5555-5555-555555555555";
  let currentTitle = "History question";
  let isDeleted = false;
  let renamedPayload: unknown = null;

  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessions: isDeleted
          ? []
          : [
              {
                id: sessionId,
                title: currentTitle,
                messageCount: 2,
                createdAt: "2026-06-29T00:00:00Z",
                updatedAt: "2026-06-29T00:00:02Z",
              },
            ],
        messages: [],
      }),
    });
  });

  await page.route(new RegExp(`/api/chat/${sessionId}(?:\\?.*)?$`), async (route) => {
    if (route.request().method() === "PATCH") {
      renamedPayload = route.request().postDataJSON();
      currentTitle = (renamedPayload as { title: string }).title;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: {
            id: sessionId,
            title: currentTitle,
            messageCount: 2,
            createdAt: "2026-06-29T00:00:00Z",
            updatedAt: "2026-06-29T00:00:02Z",
          },
        }),
      });
      return;
    }

    if (route.request().method() === "DELETE") {
      isDeleted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    await route.fallback();
  });

  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");

  await page.getByLabel("重命名 History question").click();
  await page.getByLabel("对话标题").fill("新的历史标题");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect
    .poll(() => renamedPayload)
    .toMatchObject({ title: "新的历史标题" });
  await expect(page.getByText("新的历史标题")).toBeVisible();

  await page.getByLabel("删除 新的历史标题").click();
  await expect(page.getByText("暂无历史对话")).toBeVisible();
});

test("saves an idea from the universal composer", async ({ page }) => {
  let savedPayload: unknown = null;

  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: [], messages: [] }),
    });
  });

  await page.route(/\/api\/materials$/, async (route) => {
    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          id: "88888888-8888-8888-8888-888888888888",
          title: "Build a tool radar",
          type: "text",
          fileName: "manual:idea",
          fileType: "text/plain",
          status: "ready",
          chunkCount: 1,
          metadata: { materialType: "idea" },
          createdAt: "2026-06-29T00:00:00Z",
          updatedAt: "2026-06-29T00:00:00Z",
        },
      }),
    });
  });

  await page.goto("/");

  await page.getByTestId("universal-composer-input").fill("Build a tool radar");
  await page.getByTestId("save-material-button").click();

  expect(savedPayload).toMatchObject({
    kind: "idea",
    content: "Build a tool radar",
  });
});

test("saves a link found inside pasted text", async ({ page }) => {
  let savedPayload: unknown = null;

  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: [], messages: [] }),
    });
  });

  await page.route(/\/api\/materials$/, async (route) => {
    savedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          id: "99999999-9999-9999-9999-999999999999",
          title: "https://example.com/tool",
          type: "text",
          fileName: "https://example.com/tool",
          fileType: "text/uri-list",
          status: "ready",
          chunkCount: 1,
          metadata: { materialType: "link" },
          createdAt: "2026-06-29T00:00:00Z",
          updatedAt: "2026-06-29T00:00:00Z",
        },
      }),
    });
  });

  await page.goto("/");

  await page
    .getByTestId("universal-composer-input")
    .fill("这个工具可以看看 https://example.com/tool，适合做资料库。");
  await page.getByTestId("save-material-button").click();

  expect(savedPayload).toMatchObject({
    kind: "link",
    url: "https://example.com/tool",
    content: "这个工具可以看看 https://example.com/tool，适合做资料库。",
  });
});

test("asks for uncertain material classification in chat", async ({ page }) => {
  let confirmedPayload: unknown = null;

  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            title: "Unclear tool note",
            type: "text",
            fileName: "manual:idea",
            fileType: "text/plain",
            status: "ready",
            chunkCount: 1,
            metadata: {
              materialType: "idea",
              category: "unknown",
              summary: "A note about a possible AI tool.",
              needsReview: true,
            },
            createdAt: "2026-06-29T00:00:00Z",
            updatedAt: "2026-06-29T00:00:00Z",
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/chat(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessions: [], messages: [] }),
    });
  });

  await page.route(
    /\/api\/materials\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa$/,
    async (route) => {
      if (route.request().method() === "PATCH") {
        confirmedPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            item: {
              id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
              title: "Unclear tool note",
              type: "text",
              fileName: "manual:idea",
              fileType: "text/plain",
              status: "ready",
              chunkCount: 1,
              metadata: {
                materialType: "idea",
                category: "tool",
                summary: "A note about a possible AI tool.",
                needsReview: false,
              },
              createdAt: "2026-06-29T00:00:00Z",
              updatedAt: "2026-06-29T00:00:01Z",
            },
          }),
        });
        return;
      }

      await route.fallback();
    },
  );

  await page.goto("/");

  await expect(page.getByText("我不太确定这条资料应该归到哪一类。")).toBeVisible();
  await page.getByRole("button", { name: "工具" }).click();

  expect(confirmedPayload).toMatchObject({ category: "tool" });
  await expect(page.getByText("已归类为工具")).toBeVisible();
  await expect(
    page.getByText("我不太确定这条资料应该归到哪一类。"),
  ).toBeHidden();
});

test("opens the library page and shows material details", async ({ page }) => {
  await page.route(/\/api\/knowledge-items$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            title: "AI Tool List",
            type: "text",
            fileName: "manual:idea",
            fileType: "text/plain",
            status: "ready",
            chunkCount: 1,
            metadata: {
              materialType: "idea",
              category: "tool",
              summary: "Collect AI tools by use case.",
              tags: ["idea", "tool"],
              needsReview: false,
            },
            createdAt: "2026-06-29T00:00:00Z",
            updatedAt: "2026-06-29T00:00:00Z",
          },
        ],
      }),
    });
  });

  await page.route(
    /\/api\/materials\/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb$/,
    async (route) => {
      if (route.request().method() === "PATCH") {
        const payload = route.request().postDataJSON();
        const metadata =
          "userNote" in payload
            ? {
                materialType: "idea",
                category: "tool",
                summary: "Collect AI tools by use case.",
                tags: ["idea", "tool"],
                needsReview: false,
                userNote: payload.userNote,
              }
            : {
                materialType: "idea",
                category: "tool",
                summary: "Collect AI tools by use case.",
                tags: ["idea", "tool"],
                needsReview: false,
                userNote: "重点看使用场景",
                annotations: [
                  {
                    id: "annotation-id",
                    quote: payload.annotation.quote,
                    note: payload.annotation.note,
                    createdAt: "2026-06-29T00:00:01Z",
                  },
                ],
              };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            item: {
              id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              title: "AI Tool List",
              type: "text",
              fileName: "manual:idea",
              fileType: "text/plain",
              status: "ready",
              chunkCount: 1,
              metadata,
              createdAt: "2026-06-29T00:00:00Z",
              updatedAt: "2026-06-29T00:00:01Z",
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          chunks: [{ chunkIndex: 0, content: "Collect AI tools by use case." }],
          content: "Collect AI tools by use case.",
        }),
      });
    },
  );

  await page.route(/\/api\/materials\/generate$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        prompt: "请基于以下资料生成一份项目计划。\n\n资料 1：AI Tool List",
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "资料库" }).click();

  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "资料库" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Tool List" })).toBeVisible();
  await expect(page.getByText("Collect AI tools by use case.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /导出/ })).toBeVisible();

  await page.getByLabel("处理说明").fill("重点看使用场景");
  await page.getByRole("button", { name: "保存说明" }).click();
  await expect(page.getByText("重点看使用场景")).toBeVisible();

  await page.getByPlaceholder("选中的原文片段").fill("Collect AI tools");
  await page.getByPlaceholder("给这段内容写注释").fill("这是后续工具清单的核心");
  await page.getByRole("button", { name: "保存片段注释" }).click();

  await expect(page.getByText("这是后续工具清单的核心")).toBeVisible();

  await page.getByLabel("选择 AI Tool List 生成素材").check();
  await page.getByRole("button", { name: "生成提示" }).click();
  await expect(page.getByTestId("generated-prompt")).toContainText(
    "请基于以下资料生成一份项目计划",
  );
});
