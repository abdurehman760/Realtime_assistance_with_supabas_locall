import { Injectable } from '@nestjs/common';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { VectorStoreService } from '../vector-store/vector-store.service';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

@Injectable()
export class PdfLoaderService {
  private readonly supabaseClient;

  constructor(private readonly vectorStoreService: VectorStoreService) {
    this.supabaseClient = createClient(
      'http://127.0.0.1:54321', // Local Supabase URL
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU' // Local Supabase service_role key
    );
  }

  async getChunkedDocsFromPDF(filePath: string) {
    try {
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 200,
        chunkOverlap: 20,
        separators: ["\n\n", "\n", " ", ""], // Defines splitting hierarchy
      });

      const chunkedDocs = await textSplitter.splitDocuments(docs);

      // Remove metadata from chunked documents
      const chunkedDocsWithoutMetadata = chunkedDocs.map(doc => ({
        pageContent: doc.pageContent,
      }));

      console.log(chunkedDocsWithoutMetadata);

      return chunkedDocsWithoutMetadata;
    } catch (e) {
      console.error(e);
      throw new Error("PDF docs chunking failed !");
    }
  }

  async loadAndStorePDF(filePath?: string) {
    const path = filePath || process.env.PDF_PATH;
    console.log('Loading PDF from:', path);
    const chunkedDocs = await this.getChunkedDocsFromPDF(path);
    console.log(`Chunked ${chunkedDocs.length} documents from PDF`);
    console.log('Sample chunk:', chunkedDocs[0]);
    await this.vectorStoreService.addDocumentsToStore(chunkedDocs);
  }
}
