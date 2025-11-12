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

Optional: install shadcn UI using the project's helper command (uses the provided URL):

```
npm run setup:shadcn
```

This runs:

```
npx shadcn@latest add "https://v0.app/chat/b/Vr8CSYqsECC?token=eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..0WCOsfnkW8cWAFG3.IwN3fN6yIIOpow5-0ZmNnoW3dziraVvGXbh10FXJL4udyQPr5a76KIcM.ZbjjjNEbYeM22mIGiw3Jag"
```

Run this from `external/v0-app/`.
