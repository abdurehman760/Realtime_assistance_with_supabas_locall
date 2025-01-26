// =========================================================
// IMPORTS AND CONFIGURATIONS
// =========================================================
import { Injectable } from '@nestjs/common';
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { pull } from 'langchain/hub';
import { Readable } from 'stream';
import { AudioService } from '../audio/audio.service';
import { AI_CONFIG } from '../config/ai.config';

dotenv.config();

// =========================================================
// VECTOR STORE SERVICE CLASS
// =========================================================
@Injectable()
export class VectorStoreService {
  // -------------------------
  // Class Properties
  // -------------------------
  private cache = new Map<string, any>();
  private allChunks: string = '';
  private embeddings: OpenAIEmbeddings;
  private supabaseClient: any;
  private vectorStore: SupabaseVectorStore;

  // -------------------------
  // Constructor
  // -------------------------
  constructor(private readonly audioService: AudioService) {
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

  // =========================================================
  // PRIVATE HELPER METHODS
  // =========================================================
  /**
   * Sends text with accompanying audio stream
   * @param text - The text to convert to speech
   * @param onData - Callback for handling chunks of data
   */
  private async sendTextWithAudio(text: string, onData: (chunk: any, isAudio?: boolean) => void) {
    // Start generating audio first
    const audioPromise = this.audioService.streamTextToSpeech(text);
    
    // Add a small delay before showing text (300ms)
    await new Promise(resolve => setTimeout(resolve, 1500));
    onData(text);

    try {
      const audioStream = await audioPromise;
      audioStream.on('data', (chunk) => {
        onData(chunk, true);
      });
      await new Promise((resolve) => {
        audioStream.on('end', resolve);
      });
    } catch (error) {
      console.error('Error generating audio for quick reply:', error);
    }
  }

  // =========================================================
  // PUBLIC METHODS
  // =========================================================
  /**
   * Adds documents to the Supabase vector store
   * @param docs - Array of documents to store
   */
  async addDocumentsToStore(docs: any[]) {
    try {
      console.log(`Attempting to store ${docs.length} documents...`);
      const docsWithoutMetadata = docs.map(doc => ({
        pageContent: doc.pageContent,
        metadata: {} // Ensure metadata is included but empty
      }));
      
      // Log first document for debugging
      console.log('Sample document being stored:', {
        content: docsWithoutMetadata[0].pageContent.substring(0, 100),
        metadata: docsWithoutMetadata[0].metadata
      });

      await this.vectorStore.addDocuments(docsWithoutMetadata);
      
      // Verify storage by direct query
      const count = await this.supabaseClient
        .from('documents')
        .select('count')
        .single();
      console.log('Current document count:', count.data?.count);
      
    } catch (error) {
      console.error('Error storing documents:', error);
      throw error;
    }
  }

  /**
   * Retrieves and processes queries from the vector store
   * @param query - The user's query string
   * @param onData - Callback for handling response chunks
   * @returns Promise with the complete answer
   */
  async retrieveFromStore(query: string, onData: (chunk: any, isAudio?: boolean) => void) {
    // -------------------------
    // Query Pre-processing
    // -------------------------
    console.log('\n[QUERY] Processing:', query);
    const cleanQuery = query.toLowerCase().trim();

    // Reset allChunks at the start of each request
    this.allChunks = '';
    const startTime = Date.now();

    if (this.cache.has(query)) {
      console.log('[CACHE] Found cached response');
      return this.cache.get(query);
    }

    console.log(`[SETUP] Completed in ${Date.now() - startTime}ms`);

    const retrievalStartTime = Date.now();
    const retriever = this.vectorStore.asRetriever({
      ...AI_CONFIG.retriever,
      callbacks: [{
        handleRetrieverEnd(documents) {
          console.log(`[RETRIEVAL] Found ${documents.length} relevant documents`);
        },
      }],
    });

    try {
      const testQuery = await this.supabaseClient
        .from('documents')
        .select('count')
        .single();
      console.log('Documents in database:', testQuery.data?.count);
    } catch (error) {
      console.error('Error checking document count:', error);
    }

    let prompt: ChatPromptTemplate;
    try {
      prompt = await pull<ChatPromptTemplate>('rlm/rag-prompt');
    } catch (error) {
      console.error('Error fetching prompt template:', error);
      throw new Error('Failed to fetch prompt template');
    }

    const llm = new ChatOpenAI(AI_CONFIG.chat);

    const ragChain = await createStuffDocumentsChain({
      llm,
      prompt,
      outputParser: new StringOutputParser(),
    });

    const retrievedDocs = await retriever.invoke(query);
    console.log(`[RETRIEVAL] Completed in ${Date.now() - retrievalStartTime}ms`);

    const processingStartTime = Date.now();
    const stream = await ragChain.stream({
      question: query,
      context: retrievedDocs,
    });

    console.log('[RESPONSE] Starting AI stream...');

    const readable = new Readable({
      read() {
        // no-op
      }
    });

    for await (const chunk of stream) {
      onData(chunk);
      this.allChunks += chunk;
      readable.push(chunk);
      process.stdout.write(chunk); // Show real-time response in terminal
    }

    console.log(`\n[RESPONSE] Completed in ${Date.now() - processingStartTime}ms`);
    console.log('[RESPONSE] Length:', this.allChunks.length, 'characters');

    readable.push(null);

    const answer = await new Promise((resolve, reject) => {
      let data = '';
      readable.on('data', (chunk) => {
        data += chunk;
      });
      readable.on('end', () => {
        resolve(data);
      });
      readable.on('error', (err) => {
        reject(err);
      });
    });

    console.log(`Processing time: ${Date.now() - processingStartTime}ms - Process and accumulate data chunks`);

    // Generate and stream audio after all text is received
    if (this.allChunks) {
      try {
        const audioStream = await this.audioService.streamTextToSpeech(this.allChunks);
        audioStream.on('data', (chunk) => {
          onData(chunk, true);
        });
        
        await new Promise((resolve) => {
          audioStream.on('end', resolve);
        });
      } catch (error) {
        console.error('Error generating audio:', error);
      }
    }

    
  
    return answer;
  }

  
}
