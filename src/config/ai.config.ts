export const AI_CONFIG = {
  embedding: { 
    model: 'text-embedding-3-small'
  },
  chat: { 
    model: 'gpt-4o-mini', 
    temperature: 0.4 
  },
  retriever: { 
    k: 3,
    filter: {} 
  },
  vectorStore: {
    tableName: "documents",
    queryName: "match_documents",
    distance: "cosine"
  },
  realtime: {
    keyExpirationTime: 180000 // 3 minutes in milliseconds (3 * 60 * 1000)
  }
};
