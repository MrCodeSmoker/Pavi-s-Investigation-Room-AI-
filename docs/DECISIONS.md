# Decisions

## 2026-10-25 — Gemini model defaults

The configuration defaults use `gemini-3.5-flash` for text and
`gemini-3.1-flash-image` for image generation. Google’s current model guidance
recommends these newer models for new projects; both remain environment
configuration and can be changed without code changes. The specification’s
`gemini-2.5-*` values remain compatible alternatives.

## 2026-10-25 — Local generation fallback

When no Gemini API key is configured, development uses an explicitly marked
fictional sample case only when `NODE_ENV` is `development`. Production case
creation fails clearly instead of silently returning fixture data.

