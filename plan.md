# Project Structure

```
assistant-supabase/
├── src/
│   ├── audio/
│   │   ├── audio.controller.ts
│   │   ├── audio.module.ts
│   │   └── audio.service.ts
│   ├── config/
│   │   ├── ai.config.ts
│   │   └── responses.config.ts
│   ├── manage-vector-store/
│   │   ├── manage-vector-store.controller.ts
│   │   ├── manage-vector-store.module.ts
│   │   └── manage-vector-store.service.ts
│   ├── pdf-loader/
│   │   ├── pdf-loader.controller.ts
│   │   ├── pdf-loader.module.ts
│   │   └── pdf-loader.service.ts
│   ├── vector-store/
│   │   ├── vector-store.controller.ts
│   │   ├── vector-store.module.ts
│   │   └── vector-store.service.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts
├── db/
│   └── setup.sql
├── public/
│   ├── manage-vector-store.css
│   ├── manage-vector-store.html
│   └── manage-vector-store.js
│   ├── styles.css
│   ├── index.html
│   └── script.js
├── supabase/ locall supabasee etc

├── uploads/
│   └── (temporary PDF uploads)
├── .env
├── nest-cli.json
├── package.json
├── tsconfig.build.json
└── tsconfig.json
```

## Key Directories

- `src/`: Contains all the TypeScript source code
  - `audio/`: Handles text-to-speech conversion
  - `config/`: Configuration files for AI and responses
  - `manage-vector-store/`: Vector store management endpoints
  - `pdf-loader/`: PDF processing and loading
  - `vector-store/`: Core vector store operations

- `db/`: Database setup and migrations
- `frontend/`: Frontend assets and code
- `public/`: Static files served by the application
- `uploads/`: Temporary storage for uploaded PDFs

## Key Files

- `.env`: Environment variables
- `setup.sql`: Database schema and functions
- `manage-vector-store.*`: Frontend interface for managing vector store
