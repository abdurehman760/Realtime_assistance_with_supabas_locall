export const AI_CONFIG = {
  embedding: { 
    model: 'text-embedding-3-small'
  },
  chat: { 
    model: 'gpt-4o-mini', 
    temperature: 0.4 
  },
  retriever: { 
    k: 2,
    filter: {} 
  },
  vectorStore: {
    tableName: "documents",
    queryName: "match_documents",
    distance: "cosine"
  }
};
