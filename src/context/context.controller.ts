import { Controller, Get, Query } from '@nestjs/common';
import { ContextService } from './context.service';

@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Get('retrieve')
  async getContext(@Query('query') query: string) {
    try {
      console.log('\n=== Context Query ===');
      console.log('Query:', query);
      
      const documents = await this.contextService.getRelevantDocuments(query);
      
      console.log('\n=== Retrieved Context ===');
      documents.forEach((doc, index) => {
        console.log(`\nDocument ${index + 1}:`);
        console.log('Content:', doc.content);
        console.log('Metadata:', doc.metadata);
      });
      console.log('\n===================\n');

      // Return only the array of content strings
      return documents.map(doc => doc.content);
    } catch (error) {
      console.error('\n=== Context Error ===');
      console.error(error);
      console.error('===================\n');
      throw error;
    }
  }
}
