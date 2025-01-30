import { Controller, Get, Post, Body } from '@nestjs/common';
import { FunctionHandlerService } from './function-handler.service';
import { OpenAI } from 'openai';
import { CreateFunctionDto } from './dto/types';


@Controller('functions')
export class FunctionHandlerController {
  constructor(private readonly functionHandler: FunctionHandlerService) {}

  /**
   * Endpoint to fetch all OpenAI-compatible tools.
   */
  @Get()
  async getAllFunctions(): Promise<OpenAI.ChatCompletionTool[]> {
    return this.functionHandler.getOpenAITools();
  }

  /**
   * Endpoint to create a new function.
   */
  @Post()
  async createFunction(@Body() createFunctionDto: CreateFunctionDto) {
    return this.functionHandler.createFunction(createFunctionDto);
  }
}