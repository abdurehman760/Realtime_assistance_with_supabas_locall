import { Injectable } from '@nestjs/common';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from "@supabase/supabase-js";
import { AI_CONFIG } from '../config/ai.config';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ContextService {
  private embeddings: OpenAIEmbeddings;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;

  constructor() {
    this.embeddings = new OpenAIEmbeddings(AI_CONFIG.embedding);
    this.supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!
    );
    this.vectorStore = new SupabaseVectorStore(this.embeddings, {
      client: this.supabaseClient,
      ...AI_CONFIG.vectorStore
    });
  }

  async getRelevantDocuments(query: string) {
    const retriever = this.vectorStore.asRetriever({
      ...AI_CONFIG.retriever,
    });

    try {
      const documents = await retriever.getRelevantDocuments(query);
      return documents.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }));
    } catch (error) {
      console.error('Error retrieving documents:', error);
      throw error;
    }
  }
}
