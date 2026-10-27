# AI Mystery Room

AI Mystery Room is a React + Vite frontend with an Express API. The API stores cases in MongoDB and uses the Gemini API to generate mystery cases.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB database (MongoDB Atlas works well)
- A Gemini API key

## Run locally

1. Install dependencies from the repository root:

   ```bash
   npm ci
   ```

2. Copy the example environment files and set your credentials:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   On Windows PowerShell, use `Copy-Item server/.env.example server/.env` and `Copy-Item client/.env.example client/.env`.

3. In `server/.env`, set `MONGODB_URI` and `GEMINI_API_KEY`. Keep secrets in this server file only. In `client/.env`, set `VITE_API_BASE_URL=http://localhost:5000`.

4. Start both applications:

   ```bash
   npm run dev
   ```

   The web app runs at <http://localhost:5173> and the API at <http://localhost:5000>. Check the API with <http://localhost:5000/health>.

## Deploy

This setup hosts the API on Render, the frontend on Vercel, MongoDB on Atlas, and uses Google AI Studio for the Gemini API key. The included `render.yaml` and `vercel.json` configure the app services.

### 1. Prepare MongoDB Atlas

1. Create a MongoDB Atlas cluster and database user.
2. In Network Access, allow connections from your API host. For a quick Render setup, Atlas may require `0.0.0.0/0`; use the narrowest network rule available for your plan and deployment. Treat the database password as a secret.
3. Copy the Atlas connection string. Replace its username/password placeholders, and use a database name, for example `ai_mystery_room`.

### 2. Deploy the API to Render

1. Push this project to a Git provider supported by Render.
2. In Render, choose **New > Blueprint** and select the repository. Render reads `render.yaml` and creates the API service.
3. Open the service's Environment settings and set:
   - `MONGODB_URI`: your Atlas connection string.
   - `GEMINI_API_KEY`: your Gemini API key.
   - `CLIENT_URL`: the full Vercel frontend origin, such as `https://your-app.vercel.app` (no path). Multiple origins can be comma-separated.
4. Wait for the service to deploy. Confirm `https://<your-render-service>.onrender.com/health` returns `{"status":"ok"}`. Copy the service origin without a trailing slash or `/api/v1`.

### 3. Deploy the frontend to Vercel

1. In Vercel, import the same repository. Keep the project root as the **Root Directory**; `vercel.json` builds the client workspace and publishes `client/dist`.
2. Add the environment variable `VITE_API_BASE_URL` with the Render service origin, for example `https://your-api.onrender.com` (do not add `/api/v1`).
3. Deploy the project. Vercel rebuilds the frontend when this variable changes.
4. Copy the deployed frontend origin and add it to the Render `CLIENT_URL` value. Redeploy the API after changing it.

### 4. Check the deployed app

Open the Vercel URL, create a case, and confirm it progresses to a ready state. If requests fail, check the browser console and Render logs, and verify that the Vercel origin exactly matches `CLIENT_URL` and the API URL is correct.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PORT` | API | Listening port; supplied automatically by Render. |
| `NODE_ENV` | API | Set to `production` on the host. |
| `MONGODB_URI` | API | MongoDB connection string. |
| `CLIENT_URL` | API | Allowed frontend origins, comma-separated if needed. |
| `GEMINI_API_KEY` | API | Server-side Gemini credential. Never expose it as a `VITE_` variable. |
| `GEMINI_TEXT_MODEL` | API | Gemini text model; defaults are in `server/.env.example`. |
| `GEMINI_IMAGE_MODEL` | API | Gemini image model; defaults are in `server/.env.example`. |
| `ENABLE_VIDEO` | API | Optional feature flag. |
| `UPLOAD_DIR` | API | Optional upload directory. |
| `VITE_API_BASE_URL` | Frontend | API origin, without `/api/v1`. |

Do not commit `.env` files or deploy credentials in frontend variables. If a credential has been exposed, revoke or rotate it before deployment.
