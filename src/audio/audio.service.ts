import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { Readable } from 'stream';


@Injectable()
export class AudioService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async streamTextToSpeech(text: string): Promise<Readable> {
    try {
      if (!text || text.trim() === '') {
        throw new Error('Empty text provided');
      }

      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'shimmer',
        input: text,
        response_format: 'opus',
      });

      // Get the binary data directly
      const audioData = await response.arrayBuffer();
      
      // Create a buffer from the binary data
      const buffer = Buffer.from(audioData);

      // Create a readable stream from the buffer
      const readable = new Readable();
      readable._read = () => {}; // Required implementation
      readable.push(buffer);
      readable.push(null);

      return readable;
    } catch (error) {
      console.error('Error in streamTextToSpeech:', error);
      throw error;
    }
  }
}
