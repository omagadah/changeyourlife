# v0 app (imported)

This folder contains the imported v0.app source for the AI Agent Builder.

Next steps:

1. Install dependencies:

   cd external/v0-app
   npm ci

2. Add any required environment variables by creating a `.env.local` or configuring your Vercel project.

3. Build the app:

   npm run build

4. If everything builds correctly, configure the monorepo `vercel.json` to route `/app` to this Next app.
