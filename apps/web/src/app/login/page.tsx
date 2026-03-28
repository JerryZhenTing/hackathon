"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Text,
  Stack,
  Center,
  Box,
  Anchor,
} from "@mantine/core";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    console.log({ email, password });
    setTimeout(() => router.push("/"), 600);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap');

        .login-root {
          min-height: 100vh;
          background-color: #09090b;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% -10%, rgba(56, 189, 248, 0.07) 0%, transparent 70%),
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.04) 0%, transparent 50%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'DM Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        .dot-grid {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, #27272a 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.55;
          pointer-events: none;
          z-index: 0;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
        }

        .wordmark {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: 0.18em;
          color: #f4f4f5;
          text-transform: uppercase;
        }

        .wordmark-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: #38bdf8;
          margin-left: 3px;
          vertical-align: middle;
          border-radius: 1px;
          animation: blink 1.1s step-end infinite;
          box-shadow: 0 0 6px rgba(56, 189, 248, 0.7);
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          color: #52525b;
          text-transform: uppercase;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 5px rgba(34, 197, 94, 0.6);
          animation: pulse-dot 2.5s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.85); }
        }

        .card-paper {
          background: rgba(24, 24, 27, 0.9) !important;
          border: 1px solid #27272a !important;
          backdrop-filter: blur(12px);
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.06),
            0 24px 48px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(0, 0, 0, 0.3) !important;
        }

        .input-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #71717a !important;
          margin-bottom: 6px;
        }

        .sign-in-btn {
          font-family: 'IBM Plex Mono', monospace !important;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-size: 12px !important;
          font-weight: 500 !important;
          height: 42px !important;
          background: linear-gradient(135deg, #0ea5e9, #38bdf8) !important;
          border: none !important;
          box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.3);
          transition: box-shadow 0.2s ease, transform 0.15s ease !important;
        }

        .sign-in-btn:hover:not(:disabled) {
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.35) !important;
          transform: translateY(-1px);
        }

        .sign-in-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .divider-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, #27272a, transparent);
        }

        .footer-links {
          font-size: 13px;
          color: #52525b;
          text-align: center;
        }

        .footer-links a {
          color: #71717a !important;
          text-decoration: none;
          transition: color 0.15s;
        }

        .footer-links a:hover {
          color: #a1a1aa !important;
        }

        .tagline {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #3f3f46;
          letter-spacing: 0.05em;
        }
      `}</style>

      <div className="login-root">
        <div className="dot-grid" />

        <div className="login-card">
          {/* Header */}
          <Box mb={32} style={{ textAlign: "center" }}>
            <Box mb={10}>
              <span className="wordmark">
                Remotely
                <span className="wordmark-cursor" />
              </span>
            </Box>
            <Box mb={12}>
              <span className="tagline">laptop control layer</span>
            </Box>
            <span className="status-badge">
              <span className="status-dot" />
              Secure connection established
            </span>
          </Box>

          {/* Card */}
          <Paper p={32} radius="lg" className="card-paper">
            <form onSubmit={handleSubmit}>
              <Stack gap={20}>
                <Box>
                  <Text className="input-label" component="label" htmlFor="email">
                    Email address
                  </Text>
                  <TextInput
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.currentTarget.value)}
                    required
                    styles={{
                      input: {
                        background: "#09090b",
                        border: "1px solid #27272a",
                        color: "#f4f4f5",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "14px",
                        height: "40px",
                        transition: "border-color 0.15s",
                        "&:focus": {
                          borderColor: "#38bdf8",
                          boxShadow: "0 0 0 2px rgba(56, 189, 248, 0.12)",
                        },
                        "&::placeholder": { color: "#3f3f46" },
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Box
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <Text className="input-label" component="label" htmlFor="password">
                      Password
                    </Text>
                    <Anchor
                      href="#"
                      size="xs"
                      style={{
                        color: "#52525b",
                        fontSize: 12,
                        fontFamily: "'DM Sans', sans-serif",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#71717a")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#52525b")}
                    >
                      Forgot password?
                    </Anchor>
                  </Box>
                  <PasswordInput
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    required
                    styles={{
                      input: {
                        background: "#09090b",
                        border: "1px solid #27272a",
                        color: "#f4f4f5",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: "14px",
                        height: "40px",
                      },
                      innerInput: {
                        color: "#f4f4f5",
                        fontFamily: "'DM Sans', sans-serif",
                        "&::placeholder": { color: "#3f3f46" },
                      },
                      visibilityToggle: { color: "#52525b" },
                    }}
                  />
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  className="sign-in-btn"
                  mt={4}
                >
                  {loading ? "Authenticating..." : "Sign in"}
                </Button>
              </Stack>
            </form>
          </Paper>

          {/* Footer */}
          <Box mt={24}>
            <div className="divider-line" style={{ marginBottom: 20 }} />
            <p className="footer-links">
              Don&apos;t have an account?{" "}
              <Anchor href="#" component="a">
                Sign up
              </Anchor>
            </p>
          </Box>
        </div>
      </div>
    </>
  );
}
