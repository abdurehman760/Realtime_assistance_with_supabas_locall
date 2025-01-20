# Texagon Assistant Usage Guide

## File Format Support

**Important:** Texagon Assistant currently only supports PDF files. Other file formats (docx, txt, etc.) are not supported at this time.

## Training the Assistant with New PDFs

To train the Texagon Assistant with new PDF documents:

1. Access the training page by navigating to:
   ```
   http://localhost:3000/train.html
   ```

2. On the training page:
   - Click the "Choose File" button to select a PDF document from your computer
   - Only PDF files (.pdf) are accepted
   - The selected file name will appear next to the button
   - Click "Upload and Train" to start the process

3. Training Process:
   - The status will show "Uploading file..." while the process is ongoing
   - Wait for the confirmation message "File uploaded and training completed successfully!"
   - If there's an error, the status will display the error message

4. After Training:
   - The new PDF content will be immediately available for queries
   - You can return to the main chat interface to ask questions about the newly uploaded content

## File Requirements:
- **Format:** PDF files only (.pdf)
- **Size Limit:** Maximum 10MB
- **Content:** Text-based PDFs (scanned documents may not work properly)
- **Protection:** PDFs must not be password-protected
- **Encoding:** UTF-8 compatible

## Notes:
- Ensure your PDF is readable and not password-protected
- Large PDF files may take longer to process
- The upload limit is set to 10MB by default
- Supported file format: PDF (.pdf) only
