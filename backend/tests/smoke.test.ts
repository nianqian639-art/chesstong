import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";
import { db } from "../src/services/db.js";

const testPhone = () => "139" + String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 10));
const testUsPhone = () => "+1223" + String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 10));

const login = async (phone: string): Promise<string> => {
  const app = buildServer();
  const registerResponse = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      phone,
      password: "test123456",
      role: "student",
      displayName: "测试棋手"
    }
  });
  expect(registerResponse.statusCode).toBe(200);

  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      phone,
      password: "test123456"
    }
  });
  const body = response.json() as { token: string };
  await app.close();
  return body.token;
};

describe("api smoke", () => {
  it("accepts international phone numbers and normalizes local China numbers", async () => {
    const app = buildServer();
    const usPhone = testUsPhone();
    const usRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        phone: usPhone,
        password: "public123",
        role: "student",
        displayName: "国际用户"
      }
    });
    expect(usRegister.statusCode).toBe(200);
    expect(usRegister.json().user.phone).toBe(usPhone);

    const localPhone = testPhone();
    const cnRegister = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        phone: localPhone,
        password: "public123",
        role: "student",
        displayName: "本地用户"
      }
    });
    expect(cnRegister.statusCode).toBe(200);
    expect(cnRegister.json().user.phone).toBe(`+86${localPhone}`);

    const cnLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        phone: `+86${localPhone}`,
        password: "public123"
      }
    });
    expect(cnLogin.statusCode).toBe(200);
    expect(cnLogin.json().user.phone).toBe(`+86${localPhone}`);
    await app.close();
  });

  it("registers public users without exposing password hashes", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        phone: testPhone(),
        password: "public123",
        role: "student",
        displayName: "公开用户"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      token: expect.any(String),
      user: {
        phone: expect.any(String),
        displayName: "公开用户",
        role: "student"
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("passwordHash");
    await app.close();
  });

  it("health endpoint works", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("upgrades an authenticated WebSocket connection", async () => {
    const token = await login(testPhone());
    const app = buildServer();
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const socket = new WebSocket(`${address.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`);
    try {
      const authMessage = await new Promise<string>((resolve, reject) => {
        socket.addEventListener("message", (event) => resolve(String(event.data)), { once: true });
        socket.addEventListener("error", () => reject(new Error("WebSocket upgrade failed")), { once: true });
      });
      expect(JSON.parse(authMessage)).toMatchObject({ type: "auth_ok" });
    } finally {
      socket.close();
      await app.close();
    }
  });

  it("serves the built-in puzzle starter set (297 puzzles)", async () => {
    const token = await login(testPhone());
    const app = buildServer();
    const response = await app.inject({
      method: "GET",
      url: "/problems/list",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.length).toBeGreaterThanOrEqual(200);
    await app.close();
  });

  it("accepts UCI answers and prevents repeat scoring", async () => {
    const token = await login(testPhone());
    const app = buildServer();
    const first = await app.inject({
      method: "POST",
      url: "/problems/submit",
      headers: { authorization: `Bearer ${token}` },
      payload: { problemId: "starter-001", answer: "a1a8" }
    });
    const second = await app.inject({
      method: "POST",
      url: "/problems/submit",
      headers: { authorization: `Bearer ${token}` },
      payload: { problemId: "starter-001", answer: "Ra8#" }
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ isCorrect: true, awardedPoints: 15, alreadySolved: false });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ isCorrect: true, awardedPoints: 0, alreadySolved: true });
    await app.close();
  });

  it("accepts equivalent UCI input for additional accepted puzzle answers", async () => {
    const token = await login(testPhone());
    const app = buildServer();
    const problemId = `multi-answer-${Date.now()}`;

    db.problems.push({
      id: problemId,
      gradeBand: "15",
      type: "multi_answer",
      difficulty: 1,
      knowledgePoint: "多答案测试",
      fen: "6k1/5ppp/8/8/8/8/6PP/R5K1 w - - 0 1",
      question: "这道题允许多个正确走法。",
      solution: "Ra8#",
      solutionUci: "a1a8",
      acceptedAnswers: ["Rb1"],
      hints: [],
      rating: 600,
      themes: ["test"]
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/problems/submit",
        headers: { authorization: `Bearer ${token}` },
        payload: { problemId, answer: "a1b1" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ isCorrect: true, awardedPoints: 15 });
    } finally {
      const index = db.problems.findIndex((problem) => problem.id === problemId);
      if (index >= 0) {
        db.problems.splice(index, 1);
      }
      await app.close();
    }
  });

  it("accepts any legal checkmate move for mate-in-one puzzles", async () => {
    const token = await login(testPhone());
    const app = buildServer();
    const problemId = `mate-any-${Date.now()}`;

    db.problems.push({
      id: problemId,
      gradeBand: "15",
      type: "mate_in_1",
      difficulty: 2,
      knowledgePoint: "皇后与王配合",
      fen: "8/8/8/8/8/6K1/Q7/7k w - - 0 1",
      question: "白后如何与白王配合一步将死？",
      solution: "Qg2#",
      solutionUci: "a2g2",
      acceptedAnswers: ["Qg2"],
      hints: [],
      rating: 700,
      themes: ["mateIn1"]
    });

    try {
      const sanResponse = await app.inject({
        method: "POST",
        url: "/problems/submit",
        headers: { authorization: `Bearer ${token}` },
        payload: { problemId, answer: "Qa1#" }
      });
      const uciResponse = await app.inject({
        method: "POST",
        url: "/problems/submit",
        headers: { authorization: `Bearer ${token}` },
        payload: { problemId, answer: "a2h2" }
      });

      expect(sanResponse.statusCode).toBe(200);
      expect(sanResponse.json()).toMatchObject({ isCorrect: true, awardedPoints: 15 });
      expect(uciResponse.statusCode).toBe(200);
      expect(uciResponse.json()).toMatchObject({ isCorrect: true, awardedPoints: 0, alreadySolved: true });
    } finally {
      const index = db.problems.findIndex((problem) => problem.id === problemId);
      if (index >= 0) {
        db.problems.splice(index, 1);
      }
      await app.close();
    }
  });
});
